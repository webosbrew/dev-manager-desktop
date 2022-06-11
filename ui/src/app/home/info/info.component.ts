import {Component, Injector} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import * as moment from 'moment';
import 'moment-duration-format';
import {Observable, timer} from 'rxjs';
import {map} from 'rxjs/operators';
import {Device, PackageInfo, SystemInfo} from '../../../../../main/types';
import {
  AppManagerService,
  AppsRepoService,
  DeviceManagerService,
  DevModeResponse,
  DevModeService,
  RepositoryItem,
} from '../../core/services';
import {ProgressDialogComponent} from '../../shared/components/progress-dialog/progress-dialog.component';
import {CrashesComponent} from './crashes/crashes.component';
import {RenewScriptComponent} from './renew-script/renew-script.component';

@Component({
  selector: 'app-info',
  templateUrl: './info.component.html',
  styleUrls: ['./info.component.scss']
})
export class InfoComponent {
  device: Device | null = null;
  osInfo: SystemInfo | null = null;
  devModeInfo: DevModeResponse | null = null;
  devModeRemaining: Observable<string> | null = null;
  homebrewAppInfo: PackageInfo | null = null;
  homebrewRepoManifest?: RepositoryItem;
  homebrewRepoHasUpdate: boolean = false;
  infoError: any;

  constructor(
    private modalService: NgbModal,
    private deviceManager: DeviceManagerService,
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

  private async loadDeviceInfo(): Promise<void> {
    if (!this.device) return;
    this.infoError = null;
    try {
      this.osInfo = await this.deviceManager.osInfo(this.device.name);
    } catch (e) {
      this.infoError = e;
    }
  }

  private async loadDevModeInfo(): Promise<void> {
    if (!this.device) return;
    try {
      const token = await this.deviceManager.devModeToken(this.device.name);
      if (!token) {
        throw new Error('Ignore for this case');
      }
      const devModeInfo = await this.devMode.checkDevMode(token);
      this.devModeInfo = devModeInfo;
      if (devModeInfo.errorCode == '200') {
        const expireDate = moment().add(devModeInfo.errorMsg, 'h');
        this.devModeRemaining = timer(0, 1000).pipe(map(() => moment.duration(expireDate.diff(moment())).format('hh:mm:ss')));
      }
    } catch (e) {
      this.devModeInfo = null;
      this.devModeRemaining = null;
    }
  }

  private async loadHomebrewInfo(): Promise<void> {
    if (!this.device) return;
    this.homebrewAppInfo = await this.appManager.info(this.device.name, 'org.webosbrew.hbchannel');
    this.homebrewRepoManifest = await this.appsRepo.showApp('org.webosbrew.hbchannel');
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
      await this.appManager.installUrl(this.device.name, item.manifest!.ipkUrl);
    } catch (e) {
      // Ignore
    }
    progress.close(true);
  }

  openCrashLogs(): void {
    this.modalService.open(CrashesComponent, {
      size: 'lg',
      scrollable: true,
      injector: Injector.create({
        providers: [{provide: 'device', useValue: this.device}]
      })
    });
  }
}
