import { HttpClient } from '@angular/common/http';
import { Injectable } from "@angular/core";
import novacom from '@webosose/ares-cli/lib/base/novacom';
import { BehaviorSubject, Observable } from "rxjs";
import { Device, DeviceEditSpec, Resolver, Session } from '../../../../types/novacom';
import { ElectronService } from '../electron/electron.service';
import * as util from 'util';
import { cleanupSession } from '../../../shared/util/ares-utils';
@Injectable({
  providedIn: 'root'
})
export class DeviceManagerService {

  private novacom: typeof novacom;
  private devicesSubject: BehaviorSubject<Device[]>;
  private util: typeof util;

  constructor(electron: ElectronService, private http: HttpClient) {
    this.novacom = electron.novacom;
    this.devicesSubject = new BehaviorSubject([]);
    this.util = electron.util;
    this.load();
  }

  get devices$(): Observable<Device[]> {
    return this.devicesSubject.asObservable();
  }

  load() {
    this.list().then(devices => this.onDevicesUpdated(devices));
  }

  async list(): Promise<Device[]> {
    const resolver = this.newResolver();
    const load = this.util.promisify(resolver.load);
    return load.call(resolver).then(() => resolver.devices.sort((a, b) => a.name.localeCompare(b.name)));
  }

  async addDevice(spec: DeviceEditSpec): Promise<Device> {
    return this.modifyDeviceFile('add', spec).then(devices => {
      this.onDevicesUpdated(devices);
      return devices.find((device) => spec.name == device.name);
    });
  }

  async modifyDevice(name: string, spec: Partial<DeviceEditSpec>): Promise<Device> {
    let target = { name, ...spec };
    return this.modifyDeviceFile('modify', target).then(devices => {
      this.onDevicesUpdated(devices);
      return devices.find((device) => spec.name == device.name);
    });
  }

  async setDefault(name: string): Promise<Device> {
    let target = { name, default: true };
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
    return this.http.get(`http://${address}:9991/webos_rsa`, {
      responseType: 'text'
    }).toPromise();
  }

  async deviceInfo(name: string): Promise<DeviceInfo> {
    return await this.newSession(name).then(session => new Promise<DeviceInfo>(async (resolve, reject) => {
      var outStr = '', errStr = '';
      session.run('cat /var/run/nyx/os_info.json', null, (stdout: Buffer) => {
        outStr += stdout.toString();
      }, (stderr: Buffer) => {
        errStr += stderr.toString();
      }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(JSON.parse(outStr) as DeviceInfo);
        }
      })
    })).finally(() => cleanupSession());
  }

  private async modifyDeviceFile(op: 'add' | 'modify' | 'default' | 'remove', device: Partial<DeviceEditSpec>): Promise<Device[]> {
    const resolver = this.newResolver();
    const impl = this.util.promisify(resolver.modifyDeviceFile);
    return impl.call(resolver, op, device);
  }

  private onDevicesUpdated(devices: Device[]) {
    this.devicesSubject.next(devices);
  }

  private newResolver(): Resolver {
    return new this.novacom.Resolver() as any as Resolver;
  }

  private async newSession(target: string): Promise<Session> {
    return new Promise<Session>((resolve, reject) => {
      let session: any = new this.novacom.Session(target, (error: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(session as Session);
        }
      });
    });
  }
}
export interface DeviceInfo {
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

