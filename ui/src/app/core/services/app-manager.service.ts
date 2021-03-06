import {Injectable, NgZone} from '@angular/core';
import {BehaviorSubject, Observable, Subject} from 'rxjs';
import {PackageInfo} from '../../../../../main/types';
import {IpcClient} from "./ipc-client";

@Injectable({
  providedIn: 'root'
})
export class AppManagerService extends IpcClient {

  private packagesSubjects: Map<string, Subject<PackageInfo[]>>;

  constructor(zone: NgZone) {
    super(zone, 'app-manager');
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
    return this.call<PackageInfo[]>('list', device);
  }

  async info(device: string, id: string): Promise<PackageInfo | null> {
    return this.call<PackageInfo | null>('info', device, id);
  }

  async install(device: string, path: string): Promise<void> {
    return this.call<void>('install', device, path).then(value => {
      this.load(device);
      return value;
    });
  }

  async installUrl(device: string, url: string): Promise<void> {
    return this.call<void>('installUrl', device, url).then(value => {
      this.load(device);
      return value;
    });
  }

  async remove(device: string, pkgName: string): Promise<void> {
    return this.call<void>('remove', device, pkgName).then(value => {
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
      subject = new BehaviorSubject<PackageInfo[]>([]);
      this.packagesSubjects.set(device, subject);
    }
    return subject;
  }

}
