import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, Subject} from 'rxjs';
import {Device, PackageInfo, RawPackageInfo} from '../../../../../main/types';
import {RemoteLunaService} from "./remote-luna.service";
import {RemoteCommandService} from "./remote-command.service";

@Injectable({
  providedIn: 'root'
})
export class AppManagerService {

  private packagesSubjects: Map<string, Subject<PackageInfo[]>>;

  constructor(private luna: RemoteLunaService, private cmd: RemoteCommandService) {
    this.packagesSubjects = new Map();
  }

  packages$(device: Device): Observable<PackageInfo[]> {
    return this.obtainSubject(device).asObservable();
  }

  load(device: Device): void {
    const subject = this.obtainSubject(device);
    this.list(device)
      .then(pkgs => subject.next(pkgs))
      .catch((error: any) => subject.error(error));
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

  async info(device: string, id: string): Promise<RawPackageInfo | null> {
    return null;
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

  private obtainSubject(device: Device): Subject<PackageInfo[]> {
    let subject = this.packagesSubjects.get(device.name);
    if (!subject) {
      subject = new BehaviorSubject<PackageInfo[]>([]);
      this.packagesSubjects.set(device.name, subject);
    }
    return subject;
  }

}
