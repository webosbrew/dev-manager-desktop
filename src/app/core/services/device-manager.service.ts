import {HttpClient} from '@angular/common/http';
import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable, ReplaySubject, Subject} from "rxjs";
import {Device, DeviceEditSpec, DevicePrivateKey, FileSession, Shell, SystemInfo} from '../../../types';
import {IpcClient} from "./ipc-client";
import {Attributes, FileEntry} from "ssh2-streams";
import {FileItem} from "../../../backend/device-manager/file-session";
import {MessageDialogComponent} from "../../shared/components/message-dialog/message-dialog.component";
import * as path from "path";

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

  async openShell(name: string): Promise<Shell> {
    return Promise.reject(new Error('Not implemented'));
  }

  async openFileSession(name: string): Promise<IpcFileSession> {
    return Promise.reject(new Error('Not implemented'));
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

export class IpcFileSession implements FileSession {
  downloadTemp(remotePath: string): Promise<string> {
    return Promise.resolve("");
  }

  end(): void {
  }

  get(remotePath: string, localPath: string): Promise<void> {
    return Promise.resolve(undefined);
  }

  put(localPath: string, remotePath: string): Promise<void> {
    return Promise.resolve(undefined);
  }

  readdir(location: string): Promise<FileEntry[]> {
    return Promise.resolve([]);
  }

  readdir_ext(location: string): Promise<FileItem[]> {
    return Promise.resolve([]);
  }

  readlink(path: string): Promise<string> {
    return Promise.resolve("");
  }

  rm(path: string, recursive: boolean): Promise<void> {
    return Promise.resolve(undefined);
  }

  stat(path: string): Promise<Attributes> {
    return Promise.resolve(undefined);
  }

  async uploadBatch(sources: string[], destination: string, error?: (name: string, error: Error) => Promise<boolean>): Promise<void> {
    for (const source of sources) {
      const filename: string = path.parse(source).base;
      let result = false;
      do {
        try {
          await this.put(source, path.posix.join(destination, filename));
        } catch (e) {
          if (!error) throw e;
          result = await error.call(filename, e);
        }
      } while (result);
      if (result === null) {
        break;
      }
    }
  }

}
