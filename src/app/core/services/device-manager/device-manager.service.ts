import { HttpClient } from '@angular/common/http';
import { Injectable } from "@angular/core";
import novacom from '@webosose/ares-cli/lib/base/novacom';
import { BehaviorSubject, Observable } from "rxjs";
import { ElectronService } from "..";
@Injectable({
  providedIn: 'root'
})
export class DeviceManagerService {

  private novacom: typeof novacom;
  private subject: BehaviorSubject<Device[]>;

  constructor(electron: ElectronService, private http: HttpClient) {
    this.novacom = electron.novacom;
    this.subject = new BehaviorSubject([]);
    this.load();
  }

  get devices$(): Observable<Device[]> {
    return this.subject.asObservable();
  }

  load() {
    this.list().then(devices => this.onDevicesUpdated(devices));
  }

  async list(): Promise<Device[]> {
    return new Promise<Device[]>((resolve, reject) => {
      let resolver = this.newResolver();
      resolver.load((result: any) => {
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(resolver.devices);
        }
      });
    });
  }

  async addDevice(spec: DeviceEditSpec): Promise<Device> {
    return new Promise<any>((resolve, reject) => {
      let resolver = this.newResolver();
      resolver.modifyDeviceFile('add', spec, (result: any) => {
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
        }
      });
    }).then(async () => {
      let devices = await this.list();
      this.onDevicesUpdated(devices);
      return devices.find((device) => spec.name == device.name);
    });
  }

  async removeDevice(name: string): Promise<void> {
    return new Promise<any>((resolve, reject) => {
      let resolver = this.newResolver();
      resolver.modifyDeviceFile('remove', { name }, (result: any) => {
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(null);
          this.load();
        }
      });
    });
  }

  async getPrivKey(address: string): Promise<string> {
    return this.http.get(`http://${address}:9991/webos_rsa`, {
      responseType: 'text'
    }).toPromise();
  }

  async deviceInfo(name: string): Promise<DeviceInfo> {
    return new Promise<DeviceInfo>(async (resolve, reject) => {
      let session = await this.newSession(name);
      var outStr = '', errStr = '';
      session.run('cat /var/run/nyx/os_info.json', null, (stdout: Buffer) => {
        outStr += stdout.toString();
      }, (stderr: Buffer) => {
        errStr += stderr.toString();
      }, result => {
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(JSON.parse(outStr) as DeviceInfo);
        }
      })
    });
  }

  private onDevicesUpdated(devices: Device[]) {
    this.subject.next(devices);
  }

  private newResolver(): Resolver {
    return new this.novacom.Resolver() as any as Resolver;
  }
  private async newSession(target: string): Promise<Session> {
    return new Promise<Session>((resolve, reject) => {
      let session = new this.novacom.Session(target, result => {
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(session);
        }
      });
    });
  }
}

export interface Device {
  name: string;
  description: string;
  host: string;
  port: number;
  indelible: boolean;
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
export interface DeviceEditSpec {
  name: string;
  host: string;
  port: number;
  username: string;
  profile: 'ose';
  privateKey?: { openSsh: string };
  passphrase?: string;
  password?: string;

  description?: string;
}


type RunOutput = WritableStream | Function | null;
interface Resolver {
  readonly devices: Device[];
  load(next: (result: any) => void): void;
  modifyDeviceFile(op: 'add' | 'remove', device: Partial<DeviceEditSpec>, next: (result: any) => void): void;
}

interface Session {
  run(cmd: string, stdin: ReadableStream | null, stdout: RunOutput, stderr: RunOutput, next: (result: any) => void): void;
}
