import {HttpClient} from '@angular/common/http';
import {Injectable} from "@angular/core";
import * as appdata from '@webosose/ares-cli/lib/base/cli-appdata';
import novacom from '@webosose/ares-cli/lib/base/novacom';
import luna from '@webosose/ares-cli/lib/base/luna';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import {BehaviorSubject, Observable, ReplaySubject, Subject} from "rxjs";
import * as util from 'util';
import {Device, DeviceEditSpec, Resolver, Session} from '../../../types/novacom';
import {cleanupSession} from '../../shared/util/ares-utils';
import {AllowCORSHandler} from '../../shared/util/cors-skip';
import {ElectronService} from './electron.service';
import {Readable} from "stream";
import {FileSession, NovacomFileSession, SFTPSession} from "./file-session";
import {SFTPWrapper} from "ssh2";

@Injectable({
  providedIn: 'root'
})
export class DeviceManagerService {

  private novacom: typeof novacom;
  private luna: typeof luna;
  private appdata: typeof appdata;
  private devicesSubject: Subject<Device[]>;
  private selectedSubject: Subject<Device>;
  private util: typeof util;
  private net: typeof net;
  private fs: typeof fs;
  private path: typeof path;

  constructor(private electron: ElectronService, private http: HttpClient) {
    this.novacom = electron.novacom;
    this.luna = electron.luna;
    this.appdata = electron.appdata;
    this.util = electron.util;
    this.net = electron.net;
    this.fs = electron.fs;
    this.path = electron.path;
    this.devicesSubject = new BehaviorSubject([]);
    this.selectedSubject = new BehaviorSubject(null);
    this.load();

    const session = electron.remote.session;
    const filter = {
      urls: ['http://*/*']
    };
    session.defaultSession.webRequest.onHeadersReceived(filter, AllowCORSHandler);
  }

  get devices$(): Observable<Device[]> {
    return this.devicesSubject.asObservable();
  }

  get selected$(): Observable<Device> {
    return this.selectedSubject.asObservable();
  }

  load(): void {
    this.list().then(devices => this.onDevicesUpdated(devices));
  }

  async list(): Promise<Device[]> {
    const resolver = this.newResolver();
    const load = this.util.promisify(resolver.load.bind(resolver));
    return await load()
      .then(() => resolver.devices.sort((a, b) => a.name.localeCompare(b.name)))
      .catch((error: any) => this.devicesSubject.error(error));
  }

  async addDevice(spec: DeviceEditSpec): Promise<Device> {
    return this.modifyDeviceFile('add', spec).then(devices => {
      this.onDevicesUpdated(devices);
      return devices.find((device) => spec.name == device.name);
    });
  }

  async modifyDevice(name: string, spec: Partial<DeviceEditSpec>): Promise<Device> {
    const target = {name, ...spec};
    return this.modifyDeviceFile('modify', target).then(devices => {
      this.onDevicesUpdated(devices);
      return devices.find((device) => spec.name == device.name);
    });
  }

  async setDefault(name: string): Promise<Device> {
    const target = {name, default: true};
    return this.modifyDeviceFile('default', target).then(devices => {
      this.onDevicesUpdated(devices);
      return devices.find((device) => name == device.name);
    });
  }

  async removeDevice(name: string): Promise<void> {
    return this.modifyDeviceFile('remove', {name}).then(devices => {
      this.onDevicesUpdated(devices);
    });
  }

  async getPrivKey(address: string): Promise<string> {
    return await this.http.get(`http://${address}:9991/webos_rsa`, {
      responseType: 'text'
    }).toPromise();
  }

  async checkConnectivity(address: string, port: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const conn = this.net.createConnection(port, address);
      conn.on("connect", function (e) {
        resolve(true);
        conn.end();
      }).on("error", function (e) {
        reject(e);
      });
    });
  }

  async osInfo(name: string): Promise<SystemInfo> {
    const session = await this.newSession2(name);
    return session.runAndGetOutput(`cat /var/run/nyx/os_info.json`, null)
      .then((output) => JSON.parse(output) as SystemInfo)
      .finally(() => {
        session.end();
        cleanupSession();
      });
  }

  async devModeToken(name: string): Promise<string> {
    const session = await this.newSession2(name);
    return session.runAndGetOutput(`cat /var/luna/preferences/devmode_enabled`, null).finally(() => {
      session.end();
      cleanupSession();
    });
  }

  async listCrashReports(name: string): Promise<CrashReport[]> {
    const session = await this.newSession2(name);
    return session.runAndGetOutput('find /tmp/faultmanager/crash/ -name \'*.gz\' -print0', null)
      .then(output => output.split('\0').filter(l => l.length).map(l => new CrashReport(name, l, this))).finally(() => {
        session.end();
        cleanupSession();
      });
  }

  async zcat(name: string, path: string): Promise<string> {
    const session = await this.newSession2(name);
    return session.runAndGetOutput(`xargs -0 zcat`, this.electron.stream.Readable.from(path)).finally(() => {
      session.end();
      cleanupSession();
    });
  }

  async newSession(name: string): Promise<Session> {
    return new Promise<Session>((resolve, reject) => {
      const session: any = new this.novacom.Session(name, (error: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(session as Session);
        }
      });
    });
  }

  async newSession2(name: string): Promise<NovacomSession> {
    return new Promise<NovacomSession>((resolve, reject) => {
      const session: any = new this.novacom.Session(name, (error: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(new NovacomSession(session as Session));
        }
      });
    });
  }

  async fileSession(name: string): Promise<FileSession> {
    return this.sftpSession(name).catch(() => this.novacomFileSession(name));
  }

  private sftpSession(name: string): Promise<SFTPSession> {
    return this.newSession(name).then(session => new Promise<SFTPSession>((resolve, reject) => {
      session.ssh.sftp((err, sftp) => {
        if (err) {
          reject(err);
        } else {
          resolve(new SFTPSession(sftp, this.electron));
        }
      });
    }).then(async (sftp) => {
      try {
        await sftp.stat("/dev/null");
        return sftp;
      } catch (e) {
        sftp.end();
        throw e;
      }
    }));
  }

  private novacomFileSession(name: string): Promise<FileSession> {
    return this.newSession2(name).then(session => new NovacomFileSession(session, this.electron));
  }

  async extendDevMode(device: Device): Promise<any> {
    return this.newSession(device.name).then(session => new Promise((resolve, reject) => {
      const options = {session, nReplies: 1};
      const params = {id: 'com.palmdts.devmode', subscribe: false, params: {extend: true}};
      this.luna.send(options, device.lunaAddr.launch, params, (resp) => {
        resolve(resp);
      }, (e) => reject(e));
    }));
  }

  private async modifyDeviceFile(op: 'add' | 'modify' | 'default' | 'remove', device: Partial<DeviceEditSpec>): Promise<Device[]> {
    const resolver = this.newResolver();
    const impl = this.util.promisify(resolver.modifyDeviceFile.bind(resolver));
    return await impl(op, device);
  }

  private onDevicesUpdated(devices: Device[]) {
    this.devicesSubject.next(devices);
    this.selectedSubject.next(devices.find((device) => device.default) ?? devices[0]);
  }

  private newResolver(): Resolver {
    const resolver = new this.novacom.Resolver() as any;
    const superSave = resolver.save;
    const appdata = new this.appdata();
    const getPath = this.util.promisify(appdata.getPath.bind(appdata));
    resolver.save = (devicesData: any, next: any) => {
      superSave(devicesData, async (err: any, result: any) => {
        if (err) {
          const datapath = await getPath();
          for (const conffile of this.fs.readdirSync(datapath)) {
            this.fs.chmodSync(this.path.join(datapath, conffile), 0o600);
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

export interface SystemInfo {
  core_os_kernel_version?: string
  core_os_name?: string
  core_os_release?: string
  core_os_release_codename?: string
  encryption_key_type?: string
  webos_api_version?: string
  webos_build_datetime?: string
  webos_build_id?: string
  webos_imagename?: string
  webos_manufacturing_version?: string
  webos_name: string
  webos_prerelease?: string
  webos_release: string
  webos_release_codename?: string
}

export class CrashReport {
  name: string;
  content: Observable<string>;
  private subject: Subject<string>;

  constructor(public device: string, public path: string, private dm: DeviceManagerService) {
    this.path = path;
    this.name = path.substring(path.lastIndexOf('/') + 1);
    this.subject = new ReplaySubject(1);
    this.content = this.subject.asObservable();
  }

  load(): void {
    this.dm.zcat(this.device, this.path)
      .then(content => this.subject.next(content.trim()))
      .catch(error => this.subject.error(error));
  }
}

export class NovacomSession {
  constructor(private session: Session) {
  }

  public async get(inPath: string, outPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => this.session.get(inPath, outPath, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    }));
  }

  public async put(inPath: string, outPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => this.session.put(inPath, outPath, (err, result) => {
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
