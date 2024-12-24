import {Component, Injector, OnDestroy, OnInit} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {noop, Subscription} from 'rxjs';
import {Device, RawPackageInfo} from '../types';
import {
    AppManagerService,
    AppsRepoService,
    DeviceInfo,
    DeviceManagerService,
    DevModeService,
    DevModeStatus,
    RepositoryItem,
    ScreenshotMethod,
} from '../core/services';
import {ProgressDialogComponent} from '../shared/components/progress-dialog/progress-dialog.component';
import {RenewScriptComponent} from './renew-script/renew-script.component';
import {HomebrewChannelConfiguration} from "../types/luna-apis";
import {MessageDialogComponent} from "../shared/components/message-dialog/message-dialog.component";
import {RemoteFileService} from "../core/services/remote-file.service";
import {open as openPath} from "@tauri-apps/plugin-shell";
import {APP_ID_HBCHANNEL} from "../shared/constants";
import {fromPromise} from "rxjs/internal/observable/innerFrom";

@Component({
    selector: 'app-info',
    templateUrl: './info.component.html',
    styleUrls: ['./info.component.scss']
})
export class InfoComponent implements OnInit, OnDestroy {
    device: Device | null = null;
    deviceInfo: DeviceInfo | null = null;
    devModeInfo: DevModeStatus | null = null;
    homebrewAppInfo: RawPackageInfo | null = null;
    homebrewAppConfig: Partial<HomebrewChannelConfiguration> | null = null;
    homebrewRepoManifest?: RepositoryItem;
    homebrewRepoHasUpdate: boolean = false;
    infoError: any;
    deviceSubscription!: Subscription;
    infoSubscription?: Subscription;

    constructor(
        private modalService: NgbModal,
        public deviceManager: DeviceManagerService,
        private files: RemoteFileService,
        private appManager: AppManagerService,
        private appsRepo: AppsRepoService,
        private devMode: DevModeService
    ) {
    }

    ngOnInit(): void {
        this.deviceSubscription = this.deviceManager.selected$.subscribe((selected) => {
            this.device = selected;
            this.deviceInfo = null;
            this.devModeInfo = null;
            this.homebrewAppInfo = null;
            this.homebrewAppConfig = null;
            this.loadInfo();
        });
    }

    ngOnDestroy() {
        this.deviceSubscription.unsubscribe();
        this.infoSubscription?.unsubscribe();
    }

    loadInfo(): void {
        const device = this.device;
        if (!device) return;
        this.infoError = null;
        this.infoSubscription?.unsubscribe();
        this.infoSubscription = fromPromise(this.deviceManager.getDeviceInfo(device)).subscribe({
            next: (info) => {
                this.deviceInfo = info;
                Promise.allSettled([this.loadDevModeInfo(device), this.loadHomebrewInfo(device)]).then(noop);
            },
            error: (e) => {
                this.infoError = e;
            }
        });
    }

    async renewDevMode(): Promise<void> {
        const device = this.device;
        if (!device) return;
        await this.deviceManager.extendDevMode(device);
        await this.loadDevModeInfo(device);
    }

    renewScript(): void {
        this.modalService.open(RenewScriptComponent, {
            size: 'lg',
            scrollable: true,
            injector: Injector.create({
                providers: [
                    {provide: 'device', useValue: this.device},
                    {provide: 'devMode', useValue: this.devModeInfo},
                ]
            })
        });
    }

    async takeScreenshot(method: ScreenshotMethod = 'DISPLAY'): Promise<void> {
        // TODO: unify root check
        const device = this.device;
        if (!device || device.username !== 'root') return;
        const progress = ProgressDialogComponent.open(this.modalService);
        try {
            const imgPath = await this.deviceManager.takeScreenshot(device, method);
            const tempPath = await this.files.getTemp(device, imgPath)
                .finally(() => this.files.rm(device, imgPath, false).catch(noop));
            await openPath(tempPath);
        } catch (e) {
            MessageDialogComponent.open(this.modalService, {
                message: 'Failed to take screenshot',
                error: e as Error,
                positive: 'OK'
            });
        } finally {
            progress.dismiss();
        }
    }

    private async loadDevModeInfo(device: Device): Promise<void> {
        if (!device || device.username !== 'prisoner') {
            this.devModeInfo = null;
            return;
        }
        try {
            this.devModeInfo = await this.devMode.status(device);
        } catch (e) {
            this.devModeInfo = null;
        }
    }

    private async loadHomebrewInfo(device: Device): Promise<void> {
        this.homebrewAppInfo = await this.appManager.info(device, APP_ID_HBCHANNEL);
        this.homebrewRepoManifest = await this.appsRepo.showApp(APP_ID_HBCHANNEL);
        this.homebrewAppConfig = await this.deviceManager.getHbChannelConfig(device).catch(() => null);
        if (this.homebrewRepoManifest && this.homebrewAppInfo) {
            this.homebrewRepoHasUpdate = this.homebrewRepoManifest.manifest?.hasUpdate(this.homebrewAppInfo.version) === true;
        }
    }

    async installHbChannel(): Promise<void> {
        const device = this.device;
        if (!device) return;
        const item = this.homebrewRepoManifest;
        if (!item) return;
        const progress = ProgressDialogComponent.open(this.modalService);
        const component = progress.componentInstance as ProgressDialogComponent;
        try {
            await this.appManager.installByManifest(device, item.manifest!,
                (progress, statusText) => component.update(statusText, progress));
        } catch (e) {
            // Ignore
        } finally {
            progress.close(true);
        }
        await this.loadHomebrewInfo(device);
    }

}
