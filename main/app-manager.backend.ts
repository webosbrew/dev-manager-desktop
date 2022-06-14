import {app, BrowserWindow} from 'electron';
import {cleanupSession} from './util/ares-utils';
import {PackageInfo} from './types';
import {Handle, IpcBackend} from './ipc-backend';
import {download} from 'electron-dl';
import {InstallOptions, promises} from '@webosbrew/ares-lib';
import Installer = promises.Installer;
import Launcher = promises.Launcher;

export class AppManagerBackend extends IpcBackend {

  constructor(win: BrowserWindow) {
    super(win, 'app-manager');
  }

  @Handle
  async list(device: string): Promise<PackageInfo[]> {
    const options: InstallOptions = {device};
    return await Installer.list(options)
      .then((result) => result.map((item: Partial<PackageInfo>) => ({iconPath: `${item.folderPath}/${item.icon}`, ...item} as PackageInfo)))
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
  }

  @Handle
  async info(device: string, id: string): Promise<PackageInfo | null> {
    return this.list(device).then(pkgs => pkgs.find(pkg => pkg.id == id) ?? null);
  }

  @Handle
  async install(device: string, path: string): Promise<void> {
    const options: InstallOptions = {device, appId: 'com.ares.defaultDame', opkg: false};
    try {
      await Installer.install(options, path);
    } finally {
      options.session?.end();
      cleanupSession();
    }
  }

  @Handle
  async installUrl(device: string, url: string): Promise<void> {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    const tempPath = app.getPath('temp');
    const result = await download(win, url, {
      directory: tempPath,
      filename: `devmgr_temp_${Date.now()}.ipk`
    });
    return await this.install(device, result.savePath);
  }

  @Handle
  async remove(device: string, pkgName: string): Promise<void> {
    const options: InstallOptions = {device, opkg: false};
    return await Installer.remove(options, pkgName)
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
  }

  @Handle
  async launch(device: string, appId: string): Promise<void> {
    const options: InstallOptions = {device, inspect: false};
    return await Launcher.launch(options, appId, {})
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
  }

  @Handle
  async close(device: string, appId: string): Promise<void> {
    const options: InstallOptions = {device, inspect: false};
    return await Launcher.close(options, appId, {})
      .finally(() => {
        options.session?.end();
        cleanupSession();
      });
  }
}
