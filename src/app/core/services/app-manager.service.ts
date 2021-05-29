import { Injectable } from '@angular/core';
import * as install from '@webosose/ares-cli/lib/install';
import * as launch from '@webosose/ares-cli/lib/launch';
import { BehaviorSubject, Observable } from 'rxjs';
import * as util from 'util';
import { Session } from '../../../types/novacom';
import { cleanupSession } from '../../shared/util/ares-utils';
import { ElectronService } from './electron.service';
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

  load(device: string): void {
    const subject = this.obtainSubject(device);
    this.list(device)
      .then(pkgs => subject.next(pkgs))
      .catch((error: any) => subject.error(error));
  }

  async list(device: string): Promise<PackageInfo[]> {
    const list: (...args: any[]) => Promise<any[]> = this.util.promisify(this.installLib.list);
    const options: InstallOptions = { device };
    return await list(options)
      .then((result: any[]) => result.map(item => new PackageInfo(item)))
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
  }

  async install(device: string, path: string): Promise<void> {
    const install = this.util.promisify(this.installLib.install);
    const options: InstallOptions = { device, appId: 'com.ares.defaultDame', opkg: false };
    return await install(options, path)
      .then(() => this.load(device))
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
  }

  async remove(device: string, pkgName: string): Promise<void> {
    const remove: (...args: any[]) => Promise<void> = this.util.promisify(this.installLib.remove);
    const options: InstallOptions = { device, opkg: false };
    return await remove(options, pkgName)
      .then(() => this.load(device))
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
  }

  async launch(device: string, appId: string): Promise<void> {
    const launch: (...args: any[]) => Promise<void> = this.util.promisify(this.launchLib.launch);
    const options: InstallOptions = { device, inspect: false };
    return await launch(options, appId, {})
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
  }

  async close(device: string, appId: string): Promise<void> {
    const close: (...args: any[]) => Promise<void> = this.util.promisify(this.launchLib.close);
    const options: InstallOptions = { device, inspect: false };
    return await close(options, appId, {})
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
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

interface InstallOptions {
  session?: Session
  [key: string]: any;
}
