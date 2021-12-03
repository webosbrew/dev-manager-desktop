import * as installLib from '@webosose/ares-cli/lib/install';
import * as launchLib from '@webosose/ares-cli/lib/launch';
import * as util from 'util';
import {app, BrowserWindow} from 'electron';
import {cleanupSession} from '../app/shared/util/ares-utils';
import {PackageInfo} from '../types';
import {Handle, IpcBackend} from './ipc-backend';
import {Session} from "./device-manager/device-manager.backend";
import {download} from 'electron-dl';

export class AppManagerBackend extends IpcBackend {

  constructor(win: BrowserWindow) {
    super(win, 'app-manager');
  }

  @Handle
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

  @Handle
  async info(device: string, id: string): Promise<PackageInfo | null> {
    return this.list(device).then(pkgs => pkgs.find(pkg => pkg.id == id));
  }

  @Handle
  async install(device: string, path: string): Promise<void> {
    const install: (opts: InstallOptions, path: string) => Promise<void> = util.promisify(installLib.install);
    const options: InstallOptions = {device, appId: 'com.ares.defaultDame', opkg: false};
    return await install(options, path)
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
  }

  @Handle
  async installUrl(device: string, url: string): Promise<void> {
    const tempPath = app.getPath('temp');
    const win = BrowserWindow.getFocusedWindow();
    const result = await download(win, url, {
      directory: tempPath,
      filename: `devmgr_temp_${Date.now()}.ipk`
    });
    return await this.install(device, result.savePath);
  }

  @Handle
  async remove(device: string, pkgName: string): Promise<void> {
    const remove: (...args: any[]) => Promise<void> = util.promisify(installLib.remove);
    const options: InstallOptions = {device, opkg: false};
    return await remove(options, pkgName)
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
  }

  @Handle
  async launch(device: string, appId: string): Promise<void> {
    const launch: (...args: any[]) => Promise<void> = util.promisify(launchLib.launch);
    const options: InstallOptions = {device, inspect: false};
    return await launch(options, appId, {})
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
  }

  @Handle
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
