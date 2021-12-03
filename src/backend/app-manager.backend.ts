import * as installLib from '@webosose/ares-cli/lib/install';
import * as launchLib from '@webosose/ares-cli/lib/launch';
import * as util from 'util';
import {app} from 'electron';
import {cleanupSession} from '../app/shared/util/ares-utils';
import {PackageInfo, Session} from '../types';
import {IpcBackend} from './ipc-backend';
import * as path from "path";

export class AppManagerBackend extends IpcBackend {

  constructor() {
    super('app-manager');
  }

  async list(device: string): Promise<PackageInfo[]> {
    const list: (opts: InstallOptions) => Promise<PackageInfo[]> = util.promisify(installLib.list);
    const options: InstallOptions = {device};
    return await list(options)
      .then((result) => result.map(item => ({iconPath: `${item.folderPath}/${item.icon}`, ...item})))
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
  }

  async info(device: string, id: string): Promise<PackageInfo | null> {
    return this.list(device).then(pkgs => pkgs.find(pkg => pkg.id == id));
  }

  async install(device: string, path: string): Promise<void> {
    const install: (opts: InstallOptions, path: string) => Promise<void> = util.promisify(installLib.install);
    const options: InstallOptions = {device, appId: 'com.ares.defaultDame', opkg: false};
    return await install(options, path)
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
  }

  private async downloadFile(url: string, path: string): Promise<void> {
    return Promise.reject(new Error('not implemented'));
  }

  async installUrl(device: string, url: string): Promise<void> {
    const tempPath = app.getPath('temp'), downloadPath = path.join(tempPath, `devmgr_temp_${Date.now()}.ipk`);
    await this.downloadFile(url, downloadPath);
    return await this.install(device, downloadPath);
  }

  async remove(device: string, pkgName: string): Promise<void> {
    const remove: (...args: any[]) => Promise<void> = util.promisify(installLib.remove);
    const options: InstallOptions = {device, opkg: false};
    return await remove(options, pkgName)
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
  }

  async launch(device: string, appId: string): Promise<void> {
    const launch: (...args: any[]) => Promise<void> = util.promisify(launchLib.launch);
    const options: InstallOptions = {device, inspect: false};
    return await launch(options, appId, {})
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
  }

  async close(device: string, appId: string): Promise<void> {
    const close: (...args: any[]) => Promise<void> = util.promisify(launchLib.close);
    const options: InstallOptions = {device, inspect: false};
    return await close(options, appId, {})
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
  }

}

interface InstallOptions {
  session?: Session

  [key: string]: any;
}
