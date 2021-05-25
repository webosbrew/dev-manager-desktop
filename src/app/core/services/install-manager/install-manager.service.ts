import { Injectable } from '@angular/core';
import { ElectronService } from '../electron/electron.service';
import * as install from '@webosose/ares-cli/lib/install';
@Injectable({
  providedIn: 'root'
})
export class InstallManagerService {

  private installer: typeof install;

  constructor(electron: ElectronService) {
    this.installer = electron.installer;
  }

  async list(device: string): Promise<PackageInfo[]> {
    return new Promise((resolve, reject) => {
      this.installer.list({ device }, (error: any, result: any) => {
        if (error instanceof Error) {
          reject(error);
        } else {
          resolve(result as PackageInfo[]);
        }
      });
    });
  }

}

export interface PackageInfo {
  id: string;
  type: string;
  appDescription?: string;
  vendor: string;
  version: string;
}
