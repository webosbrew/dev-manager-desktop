import {Injectable} from '@angular/core';
import {Observable, ReplaySubject, Subject} from 'rxjs';
import {PackageInfo} from '../../../types';
import {IpcClient} from "./ipc-client";

@Injectable({
  providedIn: 'root'
})
export class AppManagerService extends IpcClient {

  private packagesSubjects: Map<string, Subject<PackageInfo[]>>;

  constructor() {
    super('app-manager');
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
    return this.call('list', device);
  }

  async info(device: string, id: string): Promise<PackageInfo | null> {
    return this.call('info', device, id);
  }

  async install(device: string, path: string): Promise<void> {
    return this.call('install', device, path).then(value => {
      this.load(device);
      return value;
    });
  }

  async installUrl(device: string, url: string): Promise<void> {
    return this.call('installUrl', device, url).then(value => {
      this.load(device);
      return value;
    });
  }

  async remove(device: string, pkgName: string): Promise<void> {
    return this.call('remove', device, pkgName).then(value => {
      this.load(device);
      return value;
    });
  }

  async launch(device: string, appId: string): Promise<void> {
    return this.call('launch', device, appId);
  }

  async close(device: string, appId: string): Promise<void> {
    return this.call('close', device, appId);
  }

  private obtainSubject(device: string): Subject<PackageInfo[]> {
    let subject = this.packagesSubjects.get(device);
    if (!subject) {
      subject = new ReplaySubject(1);
      this.packagesSubjects.set(device, subject);
    }
    return subject;
  }

}

export class PackageInfoImpl implements PackageInfo {
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
