import { HttpClient } from '@angular/common/http';
import { Injectable } from "@angular/core";
import novacom from '@webosose/ares-cli/lib/base/novacom';
import { BehaviorSubject, Observable, ReplaySubject, Subject } from "rxjs";
import { Device, DeviceEditSpec, Resolver, Session } from '../../../types/novacom';
import { ElectronService } from './electron.service';
import * as util from 'util';
import * as net from 'net';
import { cleanupSession } from '../../shared/util/ares-utils';
import { Exclude, plainToClass } from 'class-transformer';
@Injectable({
  providedIn: 'root'
})
export class DeviceManagerService {

  private novacom: typeof novacom;
  private devicesSubject: BehaviorSubject<Device[]>;
  private util: typeof util;
  private net: typeof net;

  constructor(private electron: ElectronService, private http: HttpClient) {
    this.novacom = electron.novacom;
    this.util = electron.util;
    this.net = electron.net;
    this.devicesSubject = new BehaviorSubject([]);
    this.load();

    const session = electron.remote.session;
    const filter = {
      urls: ['http://*/webos_rsa']
    };
    session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
      callback({
        cancel: false,
        responseHeaders: {
          ...details.responseHeaders,
          'Access-Control-Allow-Origin': ['*']
        }
      });
    });
  }

  get devices$(): Observable<Device[]> {
    return this.devicesSubject.asObservable();
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
    const target = { name, ...spec };
    return this.modifyDeviceFile('modify', target).then(devices => {
      this.onDevicesUpdated(devices);
      return devices.find((device) => spec.name == device.name);
    });
  }

  async setDefault(name: string): Promise<Device> {
    const target = { name, default: true };
    return this.modifyDeviceFile('default', target).then(devices => {
      this.onDevicesUpdated(devices);
      return devices.find((device) => name == device.name);
    });
  }

  async removeDevice(name: string): Promise<void> {
    return this.modifyDeviceFile('remove', { name }).then(devices => {
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
    return await this.newSession(name).then(session => new Promise<SystemInfo>((resolve, reject) => {
      let outStr = '', errStr = '';
      session.run('cat /var/run/nyx/os_info.json', null, (stdout: Buffer) => {
        outStr += stdout.toString();
      }, (stderr: Buffer) => {
        errStr += stderr.toString();
      }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(JSON.parse(outStr) as SystemInfo);
        }
      });
    })).finally(() => cleanupSession());
  }

  async devModeToken(name: string): Promise<string> {
    return await this.newSession(name).then(session => new Promise<string>((resolve, reject) => {
      let outStr = '';
      session.run('cat /var/luna/preferences/devmode_enabled', null, (stdout: Buffer) => {
        outStr += stdout.toString();
      }, () => {
      }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(outStr);
        }
      });
    })).finally(() => cleanupSession());
  }

  async listCrashReports(name: string): Promise<CrashReport[]> {
    return await this.newSession(name).then(session => new Promise<CrashReport[]>((resolve, reject) => {
      let outStr = '';
      session.run('find /var/log/reports/librdx/ -name \'*.gz\' -print0', null, (stdout: Buffer) => {
        outStr += stdout.toString();
      }, () => {
      }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(outStr.split('\0').filter(l => l.length).map(l => new CrashReport(name, l, this)));
        }
      });
    })).finally(() => cleanupSession());
  }

  async zcat(name: string, path: string): Promise<string> {
    return await this.newSession(name).then(session => new Promise<string>((resolve, reject) => {
      let outStr = '';
      session.run(`xargs -0 zcat`, this.electron.stream.Readable.from(path), (stdout: Buffer) => {
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
    })).finally(() => cleanupSession());
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

  private async modifyDeviceFile(op: 'add' | 'modify' | 'default' | 'remove', device: Partial<DeviceEditSpec>): Promise<Device[]> {
    const resolver = this.newResolver();
    const impl = this.util.promisify(resolver.modifyDeviceFile.bind(resolver));
    return await impl(op, device);
  }

  private onDevicesUpdated(devices: Device[]) {
    this.devicesSubject.next(devices);
  }

  private newResolver(): Resolver {
    return new this.novacom.Resolver() as any as Resolver;
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

  load() {
    this.dm.zcat(this.device, this.path)
      .then(content => this.subject.next(content.trim()))
      .catch(error => this.subject.error(error));
  }
}
