import { Injectable, NgZone } from '@angular/core';
import * as install from '@webosose/ares-cli/lib/install';
import * as launch from '@webosose/ares-cli/lib/launch';
import { BehaviorSubject, Observable } from 'rxjs';
import * as util from 'util';
import { ElectronService } from './electron.service';
import { cleanupSession } from '../../shared/util/ares-utils';
@Injectable({
  providedIn: 'root'
})
export class AppManagerService {

  private installLib: typeof install;
  private launchLib: typeof launch;
  private util: typeof util;
  private packagesSubjects: Map<string, BehaviorSubject<PackageInfo[]>>;

  constructor(electron: ElectronService, private zone: NgZone) {
    this.installLib = electron.installLib;
    this.launchLib = electron.launchLib;
    this.util = electron.util;
    this.packagesSubjects = new Map();
  }

  packages$(device: string): Observable<PackageInfo[]> {
    return this.obtainSubject(device).asObservable();
  }

  load(device: string): void {
    const subject = this.obtainSubject(device);
    this.list(device)
      .then(pkgs => subject.next(pkgs))
      .catch((error: any) => subject.error(error));
  }

  async list(device: string): Promise<PackageInfo[]> {
    const list: (...args: any[]) => Promise<any[]> = this.util.promisify(this.installLib.list);
    return await list({ device })
      .then((result: any[]) => result.map(item => new PackageInfo(item)))
      .finally(() => cleanupSession());
  }

  async install(device: string, path: string): Promise<void> {
    const install = this.util.promisify(this.installLib.install);
    return await install({ device, appId: 'com.ares.defaultDame', opkg: false }, path)
      .then(() => this.load(device))
      .finally(() => cleanupSession());
  }

  async remove(device: string, pkgName: string): Promise<void> {
    const remove: (...args: any[]) => Promise<void> = this.util.promisify(this.installLib.remove);
    return await remove({ device, opkg: false }, pkgName)
      .then(() => this.load(device))
      .finally(() => cleanupSession());
  }

  async launch(device: string, appId: string): Promise<void> {
    const launch: (...args: any[]) => Promise<void> = this.util.promisify(this.launchLib.launch);
    return await launch({ device, inspect: false }, appId, {})
      .finally(() => cleanupSession());
  }

  async close(device: string, appId: string): Promise<void> {
    const close: (...args: any[]) => Promise<void> = this.util.promisify(this.launchLib.close);
    return await close({ device, inspect: false }, appId, {})
      .finally(() => cleanupSession());
  }

  private obtainSubject(device: string): BehaviorSubject<PackageInfo[]> {
    let subject = this.packagesSubjects.get(device);
    if (!subject) {
      subject = new BehaviorSubject([]);
      this.packagesSubjects.set(device, subject);
    }
    return subject;
  }

}

export class PackageInfo {
  id: string;
  type: string;
  title: string;
  appDescription?: string;
  vendor: string;
  version: string;
  folderPath: string;
  icon: string;

  constructor(info: Partial<PackageInfo>) {
    Object.assign(this, info);
  }

  get iconPath(): string {
    return `${this.folderPath}/${this.icon}`;
  }
}
