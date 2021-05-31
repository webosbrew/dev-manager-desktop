import { Component, Injector, OnDestroy, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import * as moment from 'moment';
import 'moment-duration-format';
import { Observable, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { Device } from '../../../types/novacom';
import { AppManagerService, AppsRepoService, DeviceManagerService, DevModeResponse, DevModeService, PackageInfo, RepositoryItem, SystemInfo } from '../../core/services';
import { ProgressDialogComponent } from '../../shared/components/progress-dialog/progress-dialog.component';
import { CrashesComponent } from './crashes/crashes.component';
@Component({
  selector: 'app-info',
  templateUrl: './info.component.html',
  styleUrls: ['./info.component.scss']
})
export class InfoComponent implements OnInit, OnDestroy {
  device: Device;
  osInfo: SystemInfo;
  devModeInfo: DevModeResponse;
  devModeRemaining: Observable<string>;
  homebrewAppInfo: PackageInfo;
  homebrewRepoManifest: RepositoryItem;
  homebrewRepoHasUpdate: boolean;
  infoError: any;

  constructor(
    private modalService: NgbModal,
    private deviceManager: DeviceManagerService,
    private appManager: AppManagerService,
    private appsRepo: AppsRepoService,
    private devMode: DevModeService
  ) {
    deviceManager.devices$.subscribe((devices) => {
      const device = devices.find((dev) => dev.default);
      this.device = device;
      if (device) {
        this.loadDeviceInfo()
          .then(() => Promise.all([this.loadDevModeInfo(), this.loadHomebrewInfo()]))
          .catch(() => { });
      }
    });
  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {

  }

  async renewDevMode(): Promise<void> {
    const token = await this.deviceManager.devModeToken(this.device.name);
    await this.devMode.resetDevMode(token);
    await this.loadDevModeInfo();
  }

  private async loadDeviceInfo(): Promise<void> {
    this.infoError = null;
    try {
      this.osInfo = await this.deviceManager.osInfo(this.device.name);
    } catch (e) {
      this.infoError = e;
    }
  }

  private async loadDevModeInfo(): Promise<void> {
    const token = await this.deviceManager.devModeToken(this.device.name);
    this.devModeInfo = await this.devMode.checkDevMode(token);
    const expireDate = moment().add(this.devModeInfo.errorMsg, 'h');
    this.devModeRemaining = timer(0, 1000).pipe(map(() => moment.duration(expireDate.diff(moment())).format('hh:mm:ss')));
  }

  private async loadHomebrewInfo(): Promise<void> {
    this.homebrewAppInfo = await this.appManager.info(this.device.name, 'org.webosbrew.hbchannel');
    this.homebrewRepoManifest = await this.appsRepo.showApp('org.webosbrew.hbchannel');
    if (this.homebrewRepoManifest && this.homebrewAppInfo) {
      this.homebrewRepoHasUpdate = this.homebrewRepoManifest.manifest.hasUpdate(this.homebrewAppInfo.version);
    }
  }

  async installHbChannel(): Promise<void> {
    const item = this.homebrewRepoManifest;
    if (!item) return;
    const progress = ProgressDialogComponent.open(this.modalService);
    try {
      await this.appManager.installUrl(this.device.name, item.manifest.ipkUrl);
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
        providers: [{ provide: 'device', useValue: this.device }]
      })
    });
  }
}
