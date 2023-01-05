import {Injectable, NgZone} from "@angular/core";
import {BehaviorSubject, from, Observable, Subject} from "rxjs";
import {
  CrashReportEntry,
  Device,
  DeviceEditSpec,
  DevicePrivateKey,
  SessionToken,
  Shell
} from '../../../../../main/types';
import {IpcClient} from "./ipc-client";
import {IpcFileSession} from "./file.session";
import {IpcShellSession} from "./shell.session";
import {HomebrewChannelConfiguration, SystemInfo} from "../../../../../main/types/luna-apis";
import {basename} from "@tauri-apps/api/path";

@Injectable({
  providedIn: 'root'
})
export class DeviceManagerService extends IpcClient {

  private devicesSubject: Subject<Device[]>;
  private selectedSubject: Subject<Device | null>;
  private shellsSubject: Subject<SessionToken[]>;

  constructor(zone: NgZone) {
    super(zone, 'device-manager');
    this.devicesSubject = new BehaviorSubject<Device[]>([]);
    this.selectedSubject = new BehaviorSubject<Device | null>(null);
    this.shellsSubject = new BehaviorSubject<SessionToken[]>([]);
    this.on('devicesUpdated', (devices: Device[]) => this.onDevicesUpdated(devices));
    this.on('shellsUpdated', (shells: SessionToken[]) => this.shellsSubject.next(shells));
  }

  get devices$(): Observable<Device[]> {
    return this.devicesSubject.asObservable();
  }

  get selected$(): Observable<Device | null> {
    return this.selectedSubject.asObservable();
  }

  get shells$(): Observable<SessionToken[]> {
    return this.shellsSubject.asObservable();
  }

  load(): void {
    this.list().then(devices => this.onDevicesUpdated(devices));
    this.callDirectly<SessionToken[]>('shell-session', 'list')
      .then(shells => this.shellsSubject.next(shells));
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

  async savePrivKey(keyName: string, keyContent: DevicePrivateKey): Promise<void> {
    return await this.call('savePrivKey', keyName, keyContent);
  }

  async checkConnectivity(address: string, port: number): Promise<boolean> {
    return await this.call('checkConnectivity', address, port);
  }

  async devModeToken(name: string): Promise<string> {
    return await this.call('devModeToken', name);
  }

  async listCrashReports(device: Device): Promise<CrashReport[]> {
    return await this.call<CrashReportEntry[]>('listCrashReports', device)
      .then(entries => Promise.all(entries.map(entry => CrashReport.obtain(this, entry.device, entry.path))));
  }

  async saveCrashReport(entry: CrashReportEntry, target: string): Promise<void> {
    return await this.call('saveCrashReport', {
      device: entry.device,
      path: entry.path
    }, target);
  }

  async zcat(device: Device, path: string): Promise<string> {
    return await this.call('zcat', device, path);
  }

  async extendDevMode(device: Device): Promise<any> {
    return await this.call('extendDevMode', device);
  }

  async getSystemInfo(device: Device): Promise<Partial<SystemInfo>> {
    return await this.lunaCall(device, 'luna://com.webos.service.tv.systemproperty/getSystemInfo', {
      keys: ['firmwareVersion', 'modelName', 'sdkVersion']
    });
  }

  async getHbChannelConfig(device: Device): Promise<Partial<HomebrewChannelConfiguration>> {
    return await this.lunaCall(device, 'luna://org.webosbrew.hbchannel.service/getConfiguration', {});
  }

  async lunaCall<Param extends Record<string, unknown>>(device: Device, uri: string, param: Param): Promise<Record<string, unknown>> {
    return await this.call('lunaCall', device, uri, param);
  }

  async openShellSession(device: Device): Promise<SessionToken> {
    return await this.callDirectly('shell-session', 'open', device);
  }

  async closeShellSession(token: SessionToken): Promise<void> {
    return await this.callDirectly('shell-session', 'close', token);
  }

  obtainShellSession(token: SessionToken): Shell {
    return new IpcShellSession(this.zone, token);
  }

  async openFileSession(name: string): Promise<IpcFileSession> {
    return new IpcFileSession(this.zone, await this.callDirectly('file-session', 'open', name));
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

export class CrashReport implements CrashReportEntry {

  constructor(public device: Device, public path: string, public title: string, public summary: string,
              public saveName: string, public content: Observable<string>) {
  }

  static async obtain(dm: DeviceManagerService, device: Device, path: string) {
    const {title, summary, saveName} = await CrashReport.parseTitle(path);
    const content = from(dm.zcat(device, path).then(content => content.trim()));
    return new CrashReport(device, path, title, summary, saveName, content);
  }

  private static async parseTitle(path: string): Promise<{ title: string, summary: string; saveName: string; }> {
    const fn = (await basename(path)).replace(/[\x00-\x1f]/g, '/').replace(/.gz$/, '');
    let match = fn.match(/.*____(.+)\.(\d+)\..+$/)
    if (match) {
      const startIdx = fn.indexOf('/'), endIdx = fn.lastIndexOf('____');
      return {
        title: match[1],
        summary: `PID: ${match[2]}`,
        saveName: fn.substring(startIdx, endIdx).replace('/', '_')
      };
    }
    const appDirPrefix = '/usr/palm/applications/';
    const appDirIdx = fn.indexOf(appDirPrefix);
    if (appDirIdx < 0) {
      return {title: 'Application Crash', summary: fn, saveName: fn.replace('/', '_')};
    }
    const substr = fn.substring(appDirIdx + appDirPrefix.length);
    const firstSlash = substr.indexOf('/'), lastSlash = substr.lastIndexOf('/');
    const appId = substr.substring(0, firstSlash > 0 ? firstSlash : undefined);
    let content = '';
    if (lastSlash > 0) {
      const lastUnderscoreIdx = substr.lastIndexOf('____');
      if (lastUnderscoreIdx > 0) {
        content = substr.substring(lastSlash + 1, lastUnderscoreIdx);
      }
    }
    return {title: appId, summary: content, saveName: fn.replace('/', '_')};
  }

}
