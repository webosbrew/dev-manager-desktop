import {CrashReportEntry, Device, DeviceEditSpec, DevicePrivateKey, Resolver, SystemInfo} from "../../types";
import {cleanupSession} from "../../app/shared/util/ares-utils";
import {Handle, IpcBackend} from "../ipc-backend";
import * as cli from '@webosose/ares-cli/lib/base/cli-appdata';
import * as novacom from '@webosose/ares-cli/lib/base/novacom';
import * as luna from '@webosose/ares-cli/lib/base/luna';
import * as fs from 'fs';
import * as path from 'path';
import {Readable, Writable} from 'stream';
import * as util from 'util';
import * as net from "net";
import {Client, utils as ssh2utils} from "ssh2";
import {BrowserWindow} from "electron";


export class DeviceManagerBackend extends IpcBackend {

  constructor(win: BrowserWindow) {
    super(win, 'device-manager');
  }

  @Handle
  async list(): Promise<Device[]> {
    const resolver = this.newResolver();
    const load = util.promisify(resolver.load.bind(resolver));
    return await load().then(() => resolver.devices.sort((a, b) => a.name.localeCompare(b.name)));
  }

  @Handle
  async addDevice(spec: DeviceEditSpec): Promise<Device> {
    return this.modifyDeviceFile('add', spec).then(devices => {
      this.onDevicesUpdated(devices);
      return devices.find((device) => spec.name == device.name);
    });
  }

  @Handle
  async modifyDevice(name: string, spec: Partial<DeviceEditSpec>): Promise<Device> {
    const target = {name, ...spec};
    return this.modifyDeviceFile('modify', target).then(devices => {
      this.onDevicesUpdated(devices);
      return devices.find((device) => spec.name == device.name);
    });
  }

  @Handle
  async setDefault(name: string): Promise<Device> {
    const target = {name, default: true};
    return this.modifyDeviceFile('default', target).then(devices => {
      this.onDevicesUpdated(devices);
      return devices.find((device) => name == device.name);
    });
  }

  @Handle
  async removeDevice(name: string): Promise<void> {
    return this.modifyDeviceFile('remove', {name}).then(devices => {
      this.onDevicesUpdated(devices);
    });
  }

  @Handle
  async hasPrivKey(privKey: string): Promise<boolean> {
    const keyPath = path.join(path.resolve(process.env.HOME || process.env.USERPROFILE, '.ssh'), privKey);
    try {
      return (await fs.promises.lstat(keyPath)).isFile();
    } catch (e) {
      return false;
    }
  }

  @Handle
  async fetchPrivKey(address: string, passphrase?: string): Promise<DevicePrivateKey> {
    return await fetch(`http://${address}:9991/webos_rsa`)
      .then(resp => resp.text())
      .then(text => {
        // Throw error if key parse failed
        const parsedKey = ssh2utils.parseKey(text, passphrase);
        if (parsedKey instanceof Error) {
          throw parsedKey;
        }
        return {data: text};
      });
  }

  @Handle
  async checkConnectivity(address: string, port: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const conn = net.createConnection(port, address);
      conn.on("connect", function (e) {
        resolve(true);
        conn.end();
      }).on("error", function (e) {
        reject(e);
      });
    });
  }

  @Handle
  async osInfo(name: string): Promise<SystemInfo> {
    const session = await this.newSession2(name);
    return session.runAndGetOutput(`cat /var/run/nyx/os_info.json`, null)
      .then((output) => JSON.parse(output) as SystemInfo)
      .finally(() => {
        session.end();
        cleanupSession();
      });
  }

  @Handle
  async devModeToken(name: string): Promise<string> {
    const session = await this.newSession2(name);
    return session.runAndGetOutput(`cat /var/luna/preferences/devmode_enabled`, null).finally(() => {
      session.end();
      cleanupSession();
    });
  }

  @Handle
  async listCrashReports(name: string): Promise<CrashReportEntry[]> {
    const session = await this.newSession2(name);
    return session.runAndGetOutput('find /tmp/faultmanager/crash/ -name \'*.gz\' -print0', null)
      .then(output => output.split('\0').filter(l => l.length).map(l => ({device: name, path: l})))
      .finally(() => {
        session.end();
        cleanupSession();
      });
  }

  @Handle
  async zcat(name: string, path: string): Promise<string> {
    const session = await this.newSession2(name);
    return session.runAndGetOutput(`xargs -0 zcat`, Readable.from(path)).finally(() => {
      session.end();
      cleanupSession();
    });
  }

  @Handle
  async newSession(name: string): Promise<Session> {
    return new Promise<Session>((resolve, reject) => {
      const session: any = new novacom.Session(name, (error: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(session as Session);
        }
      });
    });
  }

  @Handle
  async newSession2(name: string): Promise<NovacomSession> {
    return new Promise<NovacomSession>((resolve, reject) => {
      const session: any = new novacom.Session(name, (error: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(new NovacomSession(session as Session));
        }
      });
    });
  }

  @Handle
  async extendDevMode(device: Device): Promise<any> {
    return this.newSession(device.name).then(session => new Promise((resolve, reject) => {
      const options = {session, nReplies: 1};
      const params = {id: 'com.palmdts.devmode', subscribe: false, params: {extend: true}};
      luna.send(options, device.lunaAddr.launch, params, (resp) => {
        resolve(resp);
      }, (e) => reject(e));
    }));
  }

  private async modifyDeviceFile(op: 'add' | 'modify' | 'default' | 'remove', device: Partial<DeviceEditSpec>): Promise<Device[]> {
    const resolver = this.newResolver();
    const impl = util.promisify(resolver.modifyDeviceFile.bind(resolver));
    return await impl(op, device);
  }

  private onDevicesUpdated(devices: Device[]) {
    this.send('devicesUpdated', devices);
  }

  private newResolver(): Resolver {
    const resolver = new novacom.Resolver() as any;
    const superSave = resolver.save;
    const appdata = cli.default();
    const getPath = util.promisify(appdata.getPath.bind(appdata));
    resolver.save = (devicesData: any, next: any) => {
      superSave(devicesData, async (err: any, result: any) => {
        if (err) {
          const datapath = await getPath();
          for (const conffile of fs.readdirSync(datapath)) {
            fs.chmodSync(path.join(datapath, conffile), 0o600);
          }
          superSave(devicesData, next);
        } else {
          next(err, result);
        }
      });
    };
    return resolver as Resolver;
  }

}


export class NovacomSession {
  constructor(private session: Session) {
  }

  public async get(inPath: string, outPath: string): Promise<any> {
    return new Promise<any>((resolve, reject) => this.session.get(inPath, outPath, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    }));
  }

  public async put(inPath: string, outPath: string): Promise<any> {
    return new Promise<any>((resolve, reject) => this.session.put(inPath, outPath, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    }));
  }


  public async runAndGetOutput(cmd: string, stdin: Readable | null): Promise<string> {
    return new Promise((resolve, reject) => {
      let outStr = '';
      this.session.run(cmd, stdin, (stdout: Buffer) => {
        outStr += stdout.toString();
      }, (stderr) => {
        console.error(stderr.toString());
      }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(outStr);
        }
      });
    });
  }

  public end() {
    this.session.end();
    cleanupSession();
  }
}

export type RunOutput = Writable | ((buf: Buffer) => void) | null;

export interface Session {
  readonly ssh: Client;

  run(cmd: string, stdin: Readable | null, stdout: RunOutput, stderr: RunOutput, next: (error: any, result: any) => void): void;

  get(inPath: string, outPath: string, next: (error: any, result: any) => void): void;

  put(inPath: string, outPath: string, next: (error: any, result: any) => void): void;

  end(): void;
}
