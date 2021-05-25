import { Injectable, NgZone } from "@angular/core";
import novacom from '@webosose/ares-cli/lib/base/novacom';
import { BehaviorSubject, Observable } from "rxjs";
import { ElectronService } from "..";

@Injectable({
  providedIn: 'root'
})
export class DeviceManagerService {

  private novacom: typeof novacom;
  private subject: BehaviorSubject<Device[]>;

  constructor(electron: ElectronService, private ngZone: NgZone) {
    this.novacom = electron.novacom;
    this.subject = new BehaviorSubject([]);
    this.load();
  }

  get devices$(): Observable<Device[]> {
    return this.subject.asObservable();
  }

  private newResolver(): Resolver {
    return new this.novacom.Resolver() as any as Resolver;
  }

  load() {
    let resolver = this.newResolver();
    resolver.load(() => {
      this.ngZone.run(() => {
        this.subject.next(resolver.devices)
      });
    });
  }

  async addDevice(device: DeviceEditSpec) {
    return new Promise<any>((resolve, reject) => {
      let resolver = this.newResolver();
      resolver.modifyDeviceFile('add', device, (result: any) => {
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
          this.load();
        }
      });
    });
  }

  async removeDevice(name: string) {
    return new Promise<any>((resolve, reject) => {
      let resolver = this.newResolver();
      resolver.modifyDeviceFile('remove', { name }, (result: any) => {
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
          this.load();
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

interface Resolver {
  readonly devices: Device[];
  load(next: () => void): void;
  modifyDeviceFile(op: 'add' | 'remove', device: Partial<DeviceEditSpec>, next: (result: any) => void): void;
}
