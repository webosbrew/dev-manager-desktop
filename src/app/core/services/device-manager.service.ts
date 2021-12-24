import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable, ReplaySubject, Subject} from "rxjs";
import {Device, DeviceEditSpec, DevicePrivateKey, SessionToken, Shell, SystemInfo} from '../../../types';
import {IpcClient} from "./ipc-client";
import {IpcFileSession} from "./file.session";
import {IpcShellSession} from "./shell.session";

@Injectable({
  providedIn: 'root'
})
export class DeviceManagerService extends IpcClient {

  private devicesSubject: Subject<Device[]>;
  private selectedSubject: Subject<Device>;
  private shellsSubject: Subject<SessionToken[]>;

  constructor() {
    super('device-manager');
    this.devicesSubject = new BehaviorSubject([]);
    this.selectedSubject = new BehaviorSubject(null);
    this.shellsSubject = new BehaviorSubject([]);
    this.on('devicesUpdated', (devices: Device[]) => this.onDevicesUpdated(devices));
    this.on('shellsUpdated', (shells: SessionToken[]) => this.shellsSubject.next(shells));
    this.load();
    this.callDirectly('shell-session', 'list')
      .then((shells: SessionToken[]) => this.shellsSubject.next(shells));
  }

  get devices$(): Observable<Device[]> {
    return this.devicesSubject.asObservable();
  }

  get selected$(): Observable<Device> {
    return this.selectedSubject.asObservable();
  }

  get shells$(): Observable<SessionToken[]> {
    return this.shellsSubject.asObservable();
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

  async openShellSession(device: Device): Promise<SessionToken> {
    return await this.callDirectly('shell-session', 'open', device);
  }

  async closeShellSession(token: SessionToken): Promise<void> {
    return await this.callDirectly('shell-session', 'close', token);
  }

  obtainShellSession(token: SessionToken): Shell {
    return new IpcShellSession(token);
  }

  async openFileSession(name: string): Promise<IpcFileSession> {
    return new IpcFileSession(await this.callDirectly('file-session', 'open', name));
  }

  private onDevicesUpdated(devices: Device[]) {
    this.devicesSubject.next(devices);
    this.selectedSubject.next(devices.find((device) => device.default) ?? devices[0]);
  }
}

export class ShellInfo {
  title: string;

  constructor(public device: Device, public token: SessionToken) {
    this.title = device.name;
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
