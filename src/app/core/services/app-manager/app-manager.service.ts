import { Injectable } from '@angular/core';
import * as install from '@webosose/ares-cli/lib/install';
import * as launch from '@webosose/ares-cli/lib/launch';
import * as util from 'util';
import { BehaviorSubject, Observable } from 'rxjs';
import { ElectronService } from '../electron/electron.service';
import { cleanupSession } from '../../../shared/util/ares-utils';
@Injectable({
  providedIn: 'root'
})
export class AppManagerService {

  private installLib: typeof install;
  private launchLib: typeof launch;
  private util: typeof util;
  private packagesSubjects: Map<string, BehaviorSubject<PackageInfo[]>>;

  constructor(electron: ElectronService) {
    this.installLib = electron.installLib;
    this.launchLib = electron.launchLib;
    this.util = electron.util;
    this.packagesSubjects = new Map();
  }

  packages$(device: string): Observable<PackageInfo[]> {
    return this.obtainSubject(device).asObservable();
  }

  load(device: string) {
    this.list(device).then(pkgs => this.onPackagesUpdated(device, pkgs));
  }

  async list(device: string): Promise<PackageInfo[]> {
    const list: (...args: any[]) => Promise<any[]> = this.util.promisify(this.installLib.list);
    return list({ device })
      .then((result: any[]) => result.map(item => new PackageInfo(item)))
      .finally(() => cleanupSession());
  }

  async install(device: string, path: string): Promise<void> {
    const install = this.util.promisify(this.installLib.install);
    return install({ device, appId: 'com.ares.defaultDame', opkg: false }, path)
      .then(() => this.load(device))
      .finally(() => cleanupSession());
  }

  async remove(device: string, pkgName: string): Promise<void> {
    const remove = this.util.promisify(this.installLib.remove);
    return remove({ device, opkg: false }, pkgName)
      .then(() => this.load(device))
      .finally(() => cleanupSession());
  }

  async launch(device: string, appId: string): Promise<void> {
    const launch = this.util.promisify(this.launchLib.launch);
    return launch({ device, inspect: false }, appId, {})
      .finally(() => cleanupSession());
  }

  async close(device: string, appId: string): Promise<void> {
    const close = this.util.promisify(this.launchLib.close);
    return close({ device, inspect: false }, appId, {})
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

  private onPackagesUpdated(device: string, pkgs: PackageInfo[]) {
    this.obtainSubject(device).next(pkgs);
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
