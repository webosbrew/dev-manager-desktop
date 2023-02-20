import {Injectable} from '@angular/core';
import {BehaviorSubject, firstValueFrom, Observable, Subject} from 'rxjs';
import {Device, PackageInfo, RawPackageInfo} from '../../types';
import {RemoteLunaService} from "./remote-luna.service";
import {escapeSingleQuoteString, RemoteCommandService} from "./remote-command.service";
import {map} from "rxjs/operators";
import * as path from "path";
import {RemoteFileService} from "./remote-file.service";
import {PackageManifest} from "./apps-repo.service";

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
        this.packagesSubjects.delete(device.name);
        return [];
      });
  }

  async list(device: Device): Promise<PackageInfo[]> {
    return this.luna.call(device, 'luna://com.webos.applicationManager/dev/listApps')
      .then(resp => resp['apps'] as RawPackageInfo[])
      .then((result) => Promise.all(result.map(item => this.completeIcon(device, item))));
  }

  private async completeIcon(device: Device, info: RawPackageInfo): Promise<PackageInfo> {
    const data = await this.file.read(device, path.join(info.folderPath, info.icon))
      .then(d => d.length > 0 ? d : undefined)
      .catch((e) => {
        console.warn('failed to fetch app icon', e);
        return undefined;
      });
    return {iconUri: data && `data:application/octet-stream;base64,${data.toString('base64')}`, ...info}
  }

  async info(device: Device, id: string): Promise<PackageInfo | null> {
    return firstValueFrom(this.obtainSubject(device))
      .then(l => l ?? this.load(device))
      .then(l => l.find(p => p.id === id) ?? null);
  }

  async installByUri(device: Device, location: string, withHbChannel: boolean): Promise<void> {
    const ipkPath = await this.tempDownloadIpk(device, location);
    try {
      if (withHbChannel) {
        const sha256 = await this.sha256(device, ipkPath);
        const serve = await this.file.serve(device, path.posix.dirname(ipkPath));
        try {
          await this.hbChannelInstall(device, new URL(path.posix.basename(ipkPath), serve.host).toString(), sha256);
        } finally {
          serve.close();
        }
      } else {
        await this.devInstall(device, ipkPath);
      }
    } finally {
      await this.file.rm(device, ipkPath, false);
    }
  }

  async installByManifest(device: Device, manifest: PackageManifest, withHbChannel: boolean): Promise<void> {
    if (withHbChannel) {
      await this.hbChannelInstall(device, manifest.ipkUrl, manifest.ipkHash?.sha256);
    } else {
      const path = await this.tempDownloadIpk(device, manifest.ipkUrl);
      await this.devInstall(device, path).finally(() => this.file.rm(device, path, false));
    }
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
          } else if (!v.returnValue) {
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

  async launch(device: Device, appId: string, params?: Record<string, any>): Promise<void> {
    await this.luna.call(device, 'luna://com.webos.applicationManager/launch', {
      id: appId, subscribe: false, params
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

  private async tempDownloadIpk(device: Device, location: string): Promise<string> {
    const url = new URL(location);
    const path = `/tmp/devman_dl_${Date.now()}.ipk`
    switch (url.protocol) {
      case 'file:':
        await this.file.put(device, path, location);
        break;
      default:
        await this.cmd.exec(device, `curl -sL ${escapeSingleQuoteString(location)} --output ${escapeSingleQuoteString(path)}`);
        break;
    }
    return path;
  }

  private async sha256(device: Device, path: string): Promise<string> {
    return this.cmd.exec(device, `sha256sum ${escapeSingleQuoteString(path)}`, 'utf-8').then(output => {
      const match = output.match(/^(\w+)\s+/);
      if (!match) {
        throw new Error('Unable to generate checksum');
      }
      return match[1];
    });
  }

  private async devInstall(device: Device, path: string): Promise<void> {
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
          } else if (!v.returnValue) {
            reject(new Error(`${v['errorCode']}: ${v['errorText']}`));
          } else if (v['details']?.errorCode !== undefined) {
            reject(new Error(`${v['details'].errorCode}: ${v['details'].reason}`));
          } else {
            console.log('install output', v);
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
    }).finally(() => {
      this.load(device);
    });
  }

  private async hbChannelInstall(device: Device, url: string, sha256sum?: string) {
    const observable = await this.luna.subscribe(device, 'luna://org.webosbrew.hbchannel.service/install', {
      ipkUrl: url,
      ipkHash: sha256sum
    });
    return new Promise<void>((resolve, reject) => {
      const subscription = observable.subscribe({
        next: (v) => {
          if (v['finished'] === true || v.subscribed === false ||
            v['serviceName'] === 'org.webosbrew.hbchannel.service' && v['errorCode'] === -1) {
            resolve();
            subscription.unsubscribe();
          }
        }, error: (v) => {
          console.warn('subscribe error', v);
          reject(v);
        },
        complete: () => {
          console.log('subscribe complete');
          resolve();
        }
      });
    }).finally(() => {
      this.load(device);
    });
  }

}
