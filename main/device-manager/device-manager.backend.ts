import {CrashReportEntry, DevicePrivateKey, SystemInfo} from '../types';
import {cleanupSession} from '../util/ares-utils';
import {Handle, IpcBackend} from "../ipc-backend";
import * as fs from 'fs';
import * as path from 'path';
import {Readable} from 'stream';
import * as net from 'net';
import {utils as ssh2utils} from 'ssh2';
import {BrowserWindow} from 'electron';
import {Device, DeviceEditSpec, promises, Resolver as AresResolver} from '@webosbrew/ares-lib';
import axios from "axios";
import {ParsedKey} from "ssh2-streams";
import Resolver = promises.Resolver;
import Session = promises.Session;
import Luna = promises.Luna;
import CliAppData = promises.CliAppData;

export class DeviceManagerBackend extends IpcBackend {

  constructor(win: BrowserWindow) {
    super(win, 'device-manager');
  }

  @Handle
  async list(): Promise<Device[]> {
    const resolver = this.newResolver();
    return await resolver.load().then(() => resolver.devices.sort((a, b) => a.name.localeCompare(b.name)));
  }

  @Handle
  async addDevice(spec: DeviceEditSpec): Promise<Device> {
    return this.modifyDeviceFile('add', spec).then(devices => {
      this.onDevicesUpdated(devices);
      return devices.find((device) => spec.name == device.name)!;
    });
  }

  @Handle
  async modifyDevice(name: string, spec: Partial<DeviceEditSpec>): Promise<Device> {
    const target = {name, ...spec};
    return this.modifyDeviceFile('modify', target).then(devices => {
      this.onDevicesUpdated(devices);
      return devices.find((device) => spec.name == device.name)!;
    });
  }

  @Handle
  async setDefault(name: string): Promise<Device> {
    const target = {name, default: true};
    return this.modifyDeviceFile('default', target).then(devices => {
      this.onDevicesUpdated(devices);
      return devices.find((device) => name == device.name)!;
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
    const keyPath = DeviceManagerBackend.getKeyPath(privKey);
    try {
      return (await fs.promises.lstat(keyPath)).isFile();
    } catch (e) {
      return false;
    }
  }

  @Handle
  async fetchPrivKey(address: string, passphrase?: string): Promise<DevicePrivateKey> {
    // noinspection HttpUrlsUsage
    return await axios.get<string>(`http://${address}:9991/webos_rsa`)
      .then(resp => resp.data)
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
  async loadPrivKey(device: Device): Promise<DevicePrivateKey> {
    const existing = (await this.list()).find(item => item.name === device.name);
    if (!existing) {
      throw new Error('Device doesn\'t exist');
    }
    if (!existing.privateKey) {
      throw new Error('This device doesn\'t have private key');
    }
    // Throw error if key parse failed

    const parsedKey = ssh2utils.parseKey(existing.privateKey, device.passphrase);
    if (!parsedKey) {
      throw new Error("Unknown error");
    }
    if (parsedKey instanceof Error) {
      throw parsedKey;
    }
    return {data: existing.privateKey.toString(), privatePEM: (parsedKey as ParsedKey).getPrivatePEM()};
  }

  @Handle
  async savePrivKey(keyName: string, keyContent: DevicePrivateKey): Promise<void> {
    const keyPath = DeviceManagerBackend.getKeyPath(keyName);
    await fs.promises.writeFile(keyPath, keyContent.data);
  }

  @Handle
  async checkConnectivity(address: string, port: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const conn = net.createConnection(port, address);
      conn.on("connect", () => {
        resolve(true);
        conn.end();
      }).on("error", e => reject(e));
    });
  }

  @Handle
  async osInfo(name: string): Promise<SystemInfo> {
    const session = await Session.create(name);
    return DeviceManagerBackend.runAndGetOutput(session, `cat /var/run/nyx/os_info.json`, null)
      .then((output) => JSON.parse(output) as SystemInfo)
      .finally(() => {
        session.end();
        cleanupSession();
      });
  }

  @Handle
  async devModeToken(name: string): Promise<string> {
    const session = await Session.create(name);
    const cmd = 'test -f /var/luna/preferences/devmode_enabled && cat /var/luna/preferences/devmode_enabled || echo';
    return DeviceManagerBackend.runAndGetOutput(session, cmd, null).finally(() => {
      session.end();
      cleanupSession();
    }).then(v => v.trim());
  }

  @Handle
  async listCrashReports(name: string): Promise<CrashReportEntry[]> {
    const session = await Session.create(name);
    return DeviceManagerBackend.runAndGetOutput(session, 'find /tmp/faultmanager/crash/ -name \'*.gz\' -print0', null)
      .then(output => output.split('\0').filter(l => l.length).map(l => ({device: name, path: l})))
      .finally(() => {
        session.end();
        cleanupSession();
      });
  }

  @Handle
  async zcat(name: string, path: string): Promise<string> {
    const session = await Session.create(name);
    return DeviceManagerBackend.runAndGetOutput(session, `xargs -0 zcat`, Readable.from(path)).finally(() => {
      session.end();
      cleanupSession();
    });
  }

  @Handle
  async extendDevMode(device: Device): Promise<any> {
    const session = await Session.create(device.name);
    const options = {session, nReplies: 1};
    const params = {id: 'com.palmdts.devmode', subscribe: false, params: {extend: true}};
    await Luna.send(options, device.lunaAddr.launch, params);
  }

  private async modifyDeviceFile(op: 'add' | 'modify' | 'default' | 'remove', device: Partial<DeviceEditSpec>): Promise<Device[]> {
    const resolver = this.newResolver();
    return await resolver.modifyDeviceFile(op, device);
  }

  private onDevicesUpdated(devices: Device[]) {
    this.send('devicesUpdated', devices);
  }

  private newResolver(): Resolver {
    const resolver = new Resolver();
    const delegate: AresResolver = resolver.delegate as AresResolver;
    const superSave = delegate.save;

    function superSavePromisify(devicesData: Device[]): Promise<Device[]> {
      return new Promise<Device[]>((resolve, reject) => superSave(devicesData, (error, result) => {
        if (error != null) {
          reject(error);
        } else {
          resolve(result!);
        }
      }))
    }

    async function saveAsync(devicesData: Device[]): Promise<Device[]> {
      try {
        return await superSavePromisify(devicesData);
      } catch (e) {
        const appdata = CliAppData.getInstance();
        const datapath: string = await appdata.getPath();
        console.log(datapath);
        for (const conffile of await fs.promises.readdir(datapath)) {
          await fs.promises.chmod(path.join(datapath, conffile), 0o600);
        }
        return await superSavePromisify(devicesData);
      }
    }

    delegate.save = (devicesData: Device[], next?: (error?: Error, result?: Device[]) => void): Device[] => {
      if (next == null) {
        return [];
      }
      saveAsync(devicesData).then(result => next(undefined, result))
        .catch(reason => next(reason, undefined));
      return [];
    };
    return resolver;
  }

  private static getKeyPath(name: string) {
    return path.join(path.resolve(process.env.HOME ?? process.env.USERPROFILE ?? '', '.ssh'), name);
  }

  public static async runAndGetOutput(session: Session, cmd: string, stdin: Readable | null): Promise<string> {
    let outStr = '';
    await session.run(cmd, stdin, (stdout: Buffer) => {
      outStr += stdout.toString();
    }, (stderr) => {
      console.error(stderr.toString());
    });
    return outStr;
  }
}
