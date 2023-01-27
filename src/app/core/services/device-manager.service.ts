import {Injectable, NgZone} from "@angular/core";
import {BehaviorSubject, from, Observable, Subject} from "rxjs";
import {CrashReportEntry, Device, DeviceLike, DevicePrivateKey, FileSession, NewDevice} from '../../types';
import {IpcClient} from "./ipc-client";
import {FileSessionImpl} from "./file.session";
import {HomebrewChannelConfiguration, SystemInfo} from "../../types/luna-apis";
import {basename} from "@tauri-apps/api/path";
import {RemoteLunaService} from "./remote-luna.service";
import {RemoteCommandService} from "./remote-command.service";
import {Buffer} from "buffer";
import {RemoteFileService} from "./remote-file.service";

@Injectable({
  providedIn: 'root'
})
export class DeviceManagerService extends IpcClient {

  private devicesSubject: Subject<Device[]>;
  private selectedSubject: Subject<Device | null>;

  constructor(zone: NgZone, private cmd: RemoteCommandService, private file: RemoteFileService, private luna: RemoteLunaService) {
    super(zone, 'device-manager');
    this.devicesSubject = new BehaviorSubject<Device[]>([]);
    this.selectedSubject = new BehaviorSubject<Device | null>(null);
    this.on('devicesUpdated', (devices: Device[]) => this.onDevicesUpdated(devices));
  }

  get devices$(): Observable<Device[]> {
    return this.devicesSubject.asObservable();
  }

  get selected$(): Observable<Device | null> {
    return this.selectedSubject.asObservable();
  }


  load(): void {
    this.list().then(devices => this.onDevicesUpdated(devices));
    // this.invokeDirectly<SessionToken[]>('shell-session', 'list')
    //   .then(shells => this.shellsSubject.next(shells));
  }

  async list(): Promise<Device[]> {
    return await this.invoke('list');
  }

  async setDefault(name: string): Promise<Device> {
    const device = await this.invoke<Device>('set_default', {name});
    this.load();
    return device;
  }

  async removeDevice(name: string): Promise<void> {
    return await this.invoke('remove', {name});
  }

  async addDevice(device: NewDevice): Promise<Device> {
    return await this.invoke('add', {device});
  }

  async loadPrivKey(device: Device): Promise<DevicePrivateKey> {
    return await this.invoke('loadPrivKey', {device});
  }

  async novacomGetKey(address: string, passphrase: string): Promise<string> {
    return await this.invoke('novacom_getkey', {address, passphrase});
  }

  async test(device: DeviceLike): Promise<boolean> {
    return await this.invoke('test', {device});
  }

  async devModeToken(device: Device): Promise<string> {
    return await this.file.read(device, '/var/luna/preferences/devmode_enabled', 'utf-8')
      .then(s => {
        if (!s) {
          throw new Error('No dev mode token');
        }
        return s.trim();
      });
  }

  async listCrashReports(device: Device): Promise<CrashReport[]> {
    return this.cmd.exec(device, 'find /tmp/faultmanager/crash/ -name \'*.gz\' -print0', 'utf-8')
      .then(output => output.split('\0').filter(l => l.length)).then(list =>
        Promise.all(list.map(l => CrashReport.obtain(this, device, l))));
  }

  async saveCrashReport(entry: CrashReportEntry, target: string): Promise<void> {
    return await this.invoke('saveCrashReport', {
      device: entry.device,
      path: entry.path
    }, target);
  }

  async zcat(device: Device, path: string): Promise<Buffer> {
    return await this.cmd.exec(device, `xargs -0 zcat`, 'buffer', path);
  }

  async extendDevMode(device: Device): Promise<any> {
    return await this.luna.call(device, 'luna://com.webos.applicationManager/launch', {
      id: 'com.palmdts.devmode',
      subscribe: false,
      params: {extend: true}
    }, true);
  }

  async getSystemInfo(device: DeviceLike): Promise<Partial<SystemInfo>> {
    return await this.luna.call(device, 'luna://com.webos.service.tv.systemproperty/getSystemInfo', {
      keys: ['firmwareVersion', 'modelName', 'sdkVersion']
    });
  }

  async getHbChannelConfig(device: Device): Promise<Partial<HomebrewChannelConfiguration>> {
    return await this.luna.call(device, 'luna://org.webosbrew.hbchannel.service/getConfiguration', {});
  }

  fileSession(device: Device): FileSession {
    return new FileSessionImpl(this.cmd, this.file, device);
  }

  private onDevicesUpdated(devices: Device[]) {
    this.devicesSubject.next(devices);
    this.selectedSubject.next(devices.find((device) => device.default) ?? devices[0]);
  }
}

export class CrashReport implements CrashReportEntry {

  constructor(public device: Device, public path: string, public title: string, public summary: string,
              public saveName: string, public content: Observable<string>) {
  }

  static async obtain(dm: DeviceManagerService, device: Device, path: string) {
    const {title, summary, saveName} = await CrashReport.parseTitle(path);
    const content = from(dm.zcat(device, path).then(content => content.toString('utf-8').trim()));
    return new CrashReport(device, path, title, summary, saveName, content);
  }

  private static async parseTitle(path: string): Promise<{ title: string, summary: string; saveName: string; }> {
    const name = (await basename(path)).replace(/[\x00-\x1f]/g, '/').replace(/.gz$/, '');
    let appDirIdx = -1, appDirPrefix = '';
    for (const prefix of ['/usr/palm/applications/', '/var/palm/jail/']) {
      appDirIdx = name.indexOf(prefix);
      if (appDirIdx >= 0) {
        appDirPrefix = prefix;
        break;
      }
    }
    let processName = '', processId = '', summary = '', saveName = name.replace(/\//g, '_');
    let match = name.match(/.*____(.+)\.(\d+)\..+$/);
    if (match) {
      const startIdx = name.indexOf('/'), endIdx = name.lastIndexOf('____');
      processName = match[1];
      processId = match[2];
      summary = name.substring(startIdx, endIdx);
      saveName = summary.replace(/\//g, '_');
    }
    if (appDirIdx < 0) {
      return {title: `${processName} (${processId})`, summary, saveName};
    }
    const substr = name.substring(appDirIdx + appDirPrefix.length);
    const firstSlash = substr.indexOf('/'), lastSlash = substr.lastIndexOf('/');
    const appId = substr.substring(0, firstSlash > 0 ? firstSlash : undefined);
    if (lastSlash > 0) {
      const lastUnderscoreIdx = substr.lastIndexOf('____');
      if (lastUnderscoreIdx > 0) {
        summary = substr.substring(lastSlash + 1, lastUnderscoreIdx);
      }
    }
    const title = processId ? `${appId} (${processId})` : appId;
    return {title, summary, saveName};
  }

}
