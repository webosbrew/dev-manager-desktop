import {Injectable} from '@angular/core';
import {BehaviorSubject, firstValueFrom, Observable, Subject} from 'rxjs';
import {Device, PackageInfo, RawPackageInfo} from '../../../../main/types';
import {RemoteLunaService} from "./remote-luna.service";
import {RemoteCommandService} from "./remote-command.service";
import {map} from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class AppManagerService {

  private packagesSubjects: Map<string, Subject<PackageInfo[] | null>>;

  constructor(private luna: RemoteLunaService, private cmd: RemoteCommandService) {
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
    const data = await this.cmd.read(device, `${info.folderPath}/${info.icon}`);
    return {iconUri: `data:application/octet-stream;base64,${btoa(String.fromCharCode(...data))}`, ...info}
  }

  async info(device: Device, id: string): Promise<PackageInfo | null> {
    return firstValueFrom(this.obtainSubject(device))
      .then(l => l ?? this.load(device))
      .then(l => l.find(p => p.id === id) ?? null);
  }

  async install(device: string, path: string): Promise<void> {
    return;
  }

  async installUrl(device: string, url: string): Promise<void> {
    return;
  }

  async remove(device: string, pkgName: string): Promise<void> {
    // TODO: uninstall and reload apps list
  }

  async launch(device: string, appId: string): Promise<void> {

  }

  async close(device: string, appId: string): Promise<void> {

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
