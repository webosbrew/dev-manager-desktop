import {HttpClient} from '@angular/common/http';
import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable, ReplaySubject, Subject} from "rxjs";
import {Device, DeviceEditSpec, DevicePrivateKey, Shell, SystemInfo} from '../../../types';
import {IpcClient} from "./ipc-client";
import {IpcFileSession} from "./file.session";
import {IpcShellSession} from "./shell.session";

@Injectable({
  providedIn: 'root'
})
export class DeviceManagerService extends IpcClient {

  private devicesSubject: Subject<Device[]>;
  private selectedSubject: Subject<Device>;

  constructor(private http: HttpClient) {
    super('device-manager');
    this.devicesSubject = new BehaviorSubject([]);
    this.selectedSubject = new BehaviorSubject(null);
    this.on('devicesUpdated', (devices: Device[]) => this.onDevicesUpdated(devices));
    this.load();
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
    return await this.call('list');
  }

  async addDevice(spec: DeviceEditSpec): Promise<Device> {
    return await this.call('addDevice', spec);
  }

  async modifyDevice(name: string, spec: Partial<DeviceEditSpec>): Promise<Device> {
    return await this.call('modifyDevice', name, spec);
  }

  async setDefault(name: string): Promise<Device> {
    return await this.call('setDefault', name);
  }

  async removeDevice(name: string): Promise<void> {
    return await this.call('removeDevice', name);
  }

  async hasPrivKey(privKey: string): Promise<boolean> {
    return await this.call('hasPrivKey', privKey);
  }

  async loadPrivKey(device: Device): Promise<DevicePrivateKey> {
    return await this.call('loadPrivKey', device);
  }

  async fetchPrivKey(address: string, passphrase?: string): Promise<DevicePrivateKey> {
    return await this.call('fetchPrivKey', address, passphrase);
  }

  async savePrivKey(name: string, key: DevicePrivateKey): Promise<void> {
    return await this.call('savePrivKey', name, key);
  }

  async checkConnectivity(address: string, port: number): Promise<boolean> {
    return await this.call('checkConnectivity', address, port);
  }

  async osInfo(name: string): Promise<SystemInfo> {
    return await this.call('osInfo', name);
  }

  async devModeToken(name: string): Promise<string> {
    return await this.call('devModeToken', name);
  }

  async listCrashReports(name: string): Promise<CrashReport[]> {
    return await this.call('listCrashReports', name);
  }

  async zcat(name: string, path: string): Promise<string> {
    return await this.call('zcat', name, path);
  }

  async extendDevMode(device: Device): Promise<any> {
    return await this.call('extendDevMode', device);
  }

  async openShell(device: Device): Promise<Shell> {
    return new IpcShellSession(await this.callDirectly('shell-session', 'open', device));
  }

  async openFileSession(name: string): Promise<IpcFileSession> {
    return new IpcFileSession(await this.callDirectly('file-session', 'open', name));
  }

  private onDevicesUpdated(devices: Device[]) {
    this.devicesSubject.next(devices);
    this.selectedSubject.next(devices.find((device) => device.default) ?? devices[0]);
  }
}

export class CrashReport {
  name: string;
  content: Observable<string>;
  private subject: Subject<string>;

  constructor(public device: string, public path: string) {
    this.path = path;
    this.name = path.substring(path.lastIndexOf('/') + 1);
    this.subject = new ReplaySubject(1);
    this.content = this.subject.asObservable();
  }

  load(dm: DeviceManagerService): void {
    dm.zcat(this.device, this.path)
      .then(content => this.subject.next(content.trim()))
      .catch(error => this.subject.error(error));
  }
}
