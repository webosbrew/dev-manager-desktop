import {Injectable} from '@angular/core';
import {BehaviorSubject, catchError, firstValueFrom, lastValueFrom, mergeMap, noop, Observable, Subject} from 'rxjs';
import {Device, PackageInfo, RawPackageInfo} from '../../types';
import {LunaResponse, RemoteLunaService} from "./remote-luna.service";
import {escapeSingleQuoteString, RemoteCommandService} from "./remote-command.service";
import {filter, map} from "rxjs/operators";
import * as path from "path";
import {RemoteFileService, ServeInstance} from "./remote-file.service";
import {PackageManifest} from "./apps-repo.service";
import {fromPromise} from "rxjs/internal/observable/innerFrom";

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
        const serve: ServeInstance = await this.file.serve(device, ipkPath);
        try {
          await this.hbChannelInstall(device, new URL(serve.host).toString(), sha256);
        } finally {
          await serve.interrupt();
        }
      } else {
        await this.devInstall(device, ipkPath);
      }
      this.load(device).catch(noop);
    } finally {
      await this.file.rm(device, ipkPath, false);
    }
  }

  async installByManifest(device: Device, manifest: PackageManifest, withHbChannel: boolean): Promise<void> {
    if (withHbChannel) {
      await this.hbChannelInstall(device, manifest.ipkUrl, manifest.ipkHash?.sha256)
        .then(() => this.load(device).catch(noop))
        .catch((e) => {
          // Never attempt to do default install, if we are reinstalling hbchannel
          if (manifest.id === 'org.webosbrew.hbchannel') {
            throw e;
          }
          return this.installByManifest(device, manifest, false);
        });
    } else {
      const path = await this.tempDownloadIpk(device, manifest.ipkUrl);
      await this.devInstall(device, path)
        .then(() => this.load(device).catch(noop))
        .finally(() => this.file.rm(device, path, false));
    }
  }

  async remove(device: Device, id: string): Promise<void> {
    const luna = await this.luna.subscribe(device, 'luna://com.webos.appInstallService/dev/remove', {
      id, subscribe: true,
    });
    await lastValueFrom(luna.asObservable().pipe(
      map((v: LunaResponse): boolean => {
        if (v['statusValue'] === 31) {
          // statusValue = 31 means uninstallation done
          return true;
        } else if (v.returnValue === false) {
          throw new Error(`${v['errorCode']}: ${v['errorText']}`);
        } else if (v['details']?.reason !== undefined) {
          throw new Error(`${v['details'].state}: ${v['details'].reason}`);
        }
        return false;
      }),
      filter(v => v)/* Only pick finish event */,
      mergeMap(() => luna.unsubscribe()) /* Unsubscribe when done */,
      catchError((e) => fromPromise(luna.unsubscribe().then(() => {
        throw e;
      })))/* Unsubscribe when failed, and throw the error */)
    );
    await this.load(device);
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
    const luna = await this.luna.subscribe(device, 'luna://com.webos.appInstallService/dev/install', {
      id: 'com.ares.defaultName',
      ipkUrl: path,
      subscribe: true,
    });
    await lastValueFrom(luna.asObservable().pipe(
      map((v: LunaResponse): boolean => {
        if (v['statusValue'] === 30) {
          // statusValue = 30 means installation done
          return true;
        } else if (v.returnValue === false) {
          throw new Error(`${v['errorCode']}: ${v['errorText']}`);
        } else if (v['details']?.errorCode !== undefined) {
          throw new Error(`${v['details'].errorCode}: ${v['details'].reason}`);
        }
        console.debug('install output', v);
        return false;
      }),
      filter(v => v)/* Only pick finish event */,
      mergeMap(() => luna.unsubscribe()) /* Unsubscribe when done */,
      catchError((e) => fromPromise(luna.unsubscribe().then(() => {
        throw e;
      })))/* Unsubscribe when failed, and throw the error */)
    );
  }

  private async hbChannelInstall(device: Device, url: string, sha256sum?: string) {
    const luna = await this.luna.subscribe(device, 'luna://org.webosbrew.hbchannel.service/install', {
      ipkUrl: url,
      ipkHash: sha256sum,
      subscribe: true,
    });
    await lastValueFrom(luna.asObservable().pipe(
      map((v: LunaResponse): boolean => {
        if (v.returnValue === false) {
          // If returnValue is false, then it must be a failure.
          throw v;
        } else if (v['finished']) {
          return true;
        } else if (v.subscribed === false && v.returnValue) {
          // We didn't get any positive result, but there was no error either. Treat it as success.
          return true;
        }
        console.debug('install output', v);
        return false;
      }),
      filter(v => v)/* Only pick finish event */,
      mergeMap(() => luna.unsubscribe()) /* Unsubscribe when done */,
      catchError((e) => fromPromise(luna.unsubscribe().then(() => {
        throw e;
      })))/* Unsubscribe when failed, and throw the error */)
    );
  }

}
