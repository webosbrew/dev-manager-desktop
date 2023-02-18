import {Component, Injector} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import * as moment from 'moment';
import 'moment-duration-format';
import {noop, Observable, of, timer} from 'rxjs';
import {map} from 'rxjs/operators';
import {Device, FileSession, RawPackageInfo} from '../types';
import {
  AppManagerService,
  AppsRepoService,
  DeviceManagerService,
  DevModeService,
  DevModeStatus,
  RepositoryItem,
} from '../core/services';
import {ProgressDialogComponent} from '../shared/components/progress-dialog/progress-dialog.component';
import {RenewScriptComponent} from './renew-script/renew-script.component';
import {HomebrewChannelConfiguration, SystemInfo} from "../types/luna-apis";
import {MessageDialogComponent} from "../shared/components/message-dialog/message-dialog.component";
import {LunaResponseError} from "../core/services/remote-luna.service";
import {RemoteFileService} from "../core/services/remote-file.service";
import {open as openPath} from "@tauri-apps/api/shell";

@Component({
  selector: 'app-info',
  templateUrl: './info.component.html',
  styleUrls: ['./info.component.scss']
})
export class InfoComponent {
  device: Device | null = null;
  sysInfo: Partial<SystemInfo> | null = null;
  devModeInfo: DevModeStatus | null = null;
  devModeRemaining: Observable<string> | null = null;
  homebrewAppInfo: RawPackageInfo | null = null;
  homebrewAppConfig: Partial<HomebrewChannelConfiguration> | null = null;
  homebrewRepoManifest?: RepositoryItem;
  homebrewRepoHasUpdate: boolean = false;
  infoError: any;

  constructor(
    private modalService: NgbModal,
    private deviceManager: DeviceManagerService,
    private files: RemoteFileService,
    private appManager: AppManagerService,
    private appsRepo: AppsRepoService,
    private devMode: DevModeService
  ) {
    deviceManager.selected$.subscribe((selected) => {
      this.device = selected;
      this.loadInfo();
    });
  }

  loadInfo(): void {
    if (!this.device) return;
    this.loadDeviceInfo()
      .then(() => Promise.all([this.loadDevModeInfo(), this.loadHomebrewInfo()]))
      .catch(() => {
      });
  }

  async renewDevMode(): Promise<void> {
    if (!this.device) return;
    await this.deviceManager.extendDevMode(this.device);
    await this.loadDevModeInfo();
  }

  renewScript(): void {
    this.modalService.open(RenewScriptComponent, {
      size: 'lg',
      // scrollable: true,
      injector: Injector.create({
        providers: [{provide: 'device', useValue: this.device}]
      })
    });
  }

  async takeScreenshot(): Promise<void> {
    // TODO: unify root check
    const device = this.device;
    if (!device || device.username !== 'root') return;
    const progress = ProgressDialogComponent.open(this.modalService);
    try {
      const imgPath = await this.deviceManager.takeScreenshot(device);
      const tempPath = await this.files.getTemp(device, imgPath)
        .finally(() => this.files.rm(device, imgPath, false).catch(noop));
      await openPath(tempPath);
    } catch (e) {
      console.log(JSON.stringify(e));
      MessageDialogComponent.open(this.modalService, {
        message: 'Failed to take screenshot',
        error: e as Error,
        positive: 'OK'
      })
    } finally {
      progress.dismiss();
    }
  }

  private async loadDeviceInfo(): Promise<void> {
    if (!this.device) return;
    this.infoError = null;
    try {
      this.sysInfo = await this.deviceManager.getSystemInfo(this.device);
    } catch (e) {
      this.infoError = e;
    }
  }

  private async loadDevModeInfo(): Promise<void> {
    if (!this.device) return;
    try {
      const devModeInfo = await this.devMode.status(this.device);
      this.devModeInfo = devModeInfo;
      if (devModeInfo.remaining) {
        const expireDate = moment().add(devModeInfo.remaining, 'h');
        this.devModeRemaining = timer(0, 1000).pipe(map(() => moment.duration(expireDate.diff(moment())).format('hh:mm:ss')));
      } else {
        this.devModeRemaining = of("--:--");
      }
    } catch (e) {
      console.log(e);
      this.devModeInfo = null;
      this.devModeRemaining = null;
    }
  }

  private async loadHomebrewInfo(): Promise<void> {
    if (!this.device) return;
    this.homebrewAppInfo = await this.appManager.info(this.device, 'org.webosbrew.hbchannel');
    this.homebrewRepoManifest = await this.appsRepo.showApp('org.webosbrew.hbchannel');
    this.homebrewAppConfig = await this.deviceManager.getHbChannelConfig(this.device).catch(() => null);
    if (this.homebrewRepoManifest && this.homebrewAppInfo) {
      this.homebrewRepoHasUpdate = this.homebrewRepoManifest.manifest?.hasUpdate(this.homebrewAppInfo.version) === true;
    }
  }

  async installHbChannel(): Promise<void> {
    if (!this.device) return;
    const item = this.homebrewRepoManifest;
    if (!item) return;
    const progress = ProgressDialogComponent.open(this.modalService);
    try {
      await this.appManager.install(this.device, item.manifest!.ipkUrl);
    } catch (e) {
      // Ignore
    } finally {
      progress.close(true);
    }
    await this.loadHomebrewInfo();
  }

}
