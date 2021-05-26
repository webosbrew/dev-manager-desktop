import { Injectable } from '@angular/core';
import * as install from '@webosose/ares-cli/lib/install';
import * as launch from '@webosose/ares-cli/lib/launch';
import { BehaviorSubject, Observable } from 'rxjs';
import { ElectronService } from '../electron/electron.service';
@Injectable({
  providedIn: 'root'
})
export class AppManagerService {

  private installLib: typeof install;
  private launchLib: typeof launch;
  private packagesSubjects: Map<string, BehaviorSubject<PackageInfo[]>>;

  constructor(electron: ElectronService) {
    this.installLib = electron.installLib;
    this.launchLib = electron.launchLib;
    this.packagesSubjects = new Map();
  }

  packages$(device: string): Observable<PackageInfo[]> {
    return this.obtainSubject(device).asObservable();
  }

  load(device: string) {
    this.list(device).then(pkgs => this.onPackagesUpdated(device, pkgs));
  }

  async list(device: string): Promise<PackageInfo[]> {
    return new Promise((resolve, reject) => {
      this.installLib.list({ device }, (error: any, result: any[]) => {
        if (error instanceof Error) {
          reject(error);
        } else {
          resolve(result.map(item => new PackageInfo(item)));
        }
      });
    });
  }

  async install(device: string, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.installLib.install({ device, appId: 'com.ares.defaultDame', opkg: false }, path, (error: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(null);
        }
      });
    }).then(() => this.load(device));
  }

  async remove(device: string, pkgName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.installLib.remove({ device, opkg: false }, pkgName, (error: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(null);
        }
      });
    }).then(() => this.load(device));
  }

  async launch(device: string, appId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.launchLib.launch({ device, inspect: false }, appId, {}, (error: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(null);
        }
      });
    })
  }

  async close(device: string, appId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.launchLib.close({ device, inspect: false }, appId, {}, (error: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(null);
        }
      });
    })
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
