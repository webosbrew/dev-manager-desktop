import {Injectable} from '@angular/core';
import {BehaviorSubject, firstValueFrom, Observable, Subject} from 'rxjs';
import {Device, PackageInfo, RawPackageInfo} from '../../types';
import {RemoteLunaService} from "./remote-luna.service";
import {escapeSingleQuoteString, RemoteCommandService} from "./remote-command.service";
import {map} from "rxjs/operators";
import * as path from "path";
import {RemoteFileService} from "./remote-file.service";

@Injectable({
  providedIn: 'root'
})
export class AppManagerService {

  private packagesSubjects: Map<string, Subject<PackageInfo[] | null>>;

  constructor(private luna: RemoteLunaService, private cmd: RemoteCommandService, private file: RemoteFileService) {
    this.packagesSubjects = new Map();
  }

  packages$(device: Device): Observable<PackageInfo[]> {
    return this.obtainSubject(device).pipe(map(v => v ?? []));
  }

  async load(device: Device): Promise<PackageInfo[]> {
    const subject = this.obtainSubject(device);
    return this.list(device)
      .then(pkgs => {
        subject.next(pkgs);
        return pkgs;
      })
      .catch((error: any) => {
        subject.error(error);
        return [];
      });
  }

  async list(device: Device): Promise<PackageInfo[]> {
    return this.luna.call(device, 'luna://com.webos.applicationManager/dev/listApps')
      .then(resp => resp['apps'] as RawPackageInfo[])
      .then((result) => Promise.all(result.map(item => this.completeIcon(device, item))));
  }

  private async completeIcon(device: Device, info: RawPackageInfo): Promise<PackageInfo> {
    const data = await this.file.read(device, path.join(info.folderPath, info.icon)).catch(() => undefined);
    return {iconUri: data && `data:application/octet-stream;base64,${data.toString('base64')}`, ...info}
  }

  async info(device: Device, id: string): Promise<PackageInfo | null> {
    return firstValueFrom(this.obtainSubject(device))
      .then(l => l ?? this.load(device))
      .then(l => l.find(p => p.id === id) ?? null);
  }

  async install(device: Device, location: string): Promise<void> {
    const url = new URL(location);
    const path = `/tmp/devman_dl_${Date.now()}.ipk`
    switch (url.protocol) {
      case 'file:':
        await this.file.put(device, path, location);
        break;
      default:
        await this.cmd.exec(device, `wget -qO ${escapeSingleQuoteString(path)} ${escapeSingleQuoteString(location)}`);
        break;
    }
    const observable = await this.luna.subscribe(device, 'luna://com.webos.appInstallService/dev/install', {
      id: 'com.ares.defaultName',
      ipkUrl: path,
      subscribe: true,
    });
    return new Promise<void>((resolve, reject) => {
      const subscription = observable.subscribe({
        next: (v) => {
          if (v['statusValue'] === 30) {
            resolve();
          } else if (v['returnValue'] === false) {
            reject(new Error(`${v['errorCode']}: ${v['errorText']}`));
          } else if (v['details']?.errorCode !== undefined) {
            reject(new Error(`${v['details'].errorCode}: ${v['details'].reason}`));
          } else {
            return;
          }
          subscription.unsubscribe();
        }, error: (v) => {
          console.warn('subscribe error', v);
          reject(v);
        },
        complete: () => {
          console.log('subscribe complete');
          resolve();
        }
      });
    }).finally(() => this.load(device));
  }

  async remove(device: Device, id: string): Promise<void> {
    const observable = await this.luna.subscribe(device, 'luna://com.webos.appInstallService/dev/remove', {
      id, subscribe: true,
    });
    return new Promise<void>((resolve, reject) => {
      const subscription = observable.subscribe({
        next: (v) => {
          if (v['statusValue'] === 31) {
            resolve();
          } else if (v['returnValue'] === false) {
            reject(new Error(`${v['errorCode']}: ${v['errorText']}`));
          } else if (v['details']?.reason !== undefined) {
            reject(new Error(`${v['details'].state}: ${v['details'].reason}`));
          } else {
            return;
          }
          subscription.unsubscribe();
        }, error: (v) => {
          console.warn('subscribe error', v);
          reject(v);
        },
        complete: () => {
          console.log('subscribe complete');
          resolve();
        }
      });
    }).finally(() => this.load(device));
  }

  async launch(device: Device, appId: string): Promise<void> {
    await this.luna.call(device, 'luna://com.webos.applicationManager/launch', {
      id: appId,
      subscribe: false,
    }, true);
  }

  private obtainSubject(device: Device): Subject<PackageInfo[] | null> {
    let subject = this.packagesSubjects.get(device.name);
    if (!subject) {
      subject = new BehaviorSubject<PackageInfo[] | null>(null);
      this.packagesSubjects.set(device.name, subject);
    }
    return subject;
  }

}
