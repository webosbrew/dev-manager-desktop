import {Component, Injector, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {noop, Observable, Subscription} from 'rxjs';
import {Device, PackageInfo, RawPackageInfo} from '../types';
import {AppManagerService, DeviceManagerService, RepositoryItem} from '../core/services';
import {MessageDialogComponent} from '../shared/components/message-dialog/message-dialog.component';
import {ProgressDialogComponent} from '../shared/components/progress-dialog/progress-dialog.component';
import {keyBy} from 'lodash';
import {open as showOpenDialog} from '@tauri-apps/api/dialog';
import {basename, downloadDir} from "@tauri-apps/api/path";
import {APP_ID_HBCHANNEL} from "../shared/constants";
import {HbchannelRemoveComponent} from "./hbchannel-remove/hbchannel-remove.component";
import {StatStorageInfoComponent} from "../shared/components/stat-storage-info/stat-storage-info.component";
import {DetailsComponent} from "./details/details.component";

@Component({
    selector: 'app-apps',
    templateUrl: './apps.component.html',
    styleUrls: ['./apps.component.scss']
})
export class AppsComponent implements OnInit, OnDestroy {

    packages$?: Observable<PackageInfo[] | null>;
    instPackages?: Record<string, RawPackageInfo>;
    device: Device | null = null;
    tabId: string = 'installed';

    @ViewChild('storageInfo') storageInfo?: StatStorageInfoComponent;

    private deviceSubscription?: Subscription;
    private packagesSubscription?: Subscription;

    constructor(
        private modalService: NgbModal,
        private deviceManager: DeviceManagerService,
        private appManager: AppManagerService,
    ) {
    }

    ngOnInit(): void {
        this.deviceSubscription = this.deviceManager.selected$.subscribe((device) => {
            this.device = device;
            if (device) {
                this.loadPackages();
            } else {
                this.packages$ = undefined;
                this.packagesSubscription?.unsubscribe();
                this.packagesSubscription = undefined;
            }
        });
    }

    ngOnDestroy(): void {
        this.deviceSubscription?.unsubscribe();
        this.packagesSubscription?.unsubscribe();
        this.packagesSubscription = undefined;
    }

    loadPackages(): void {
        const device = this.device;
        if (!device) return;
        this.packagesSubscription?.unsubscribe();
        this.packages$ = this.appManager.packages$(device);
        this.packagesSubscription = this.packages$.subscribe({
            next: (pkgs) => {
                if (pkgs?.length) {
                    this.instPackages = keyBy(pkgs, (pkg) => pkg.id);
                }
            }, error: noop
        });
        this.appManager.load(device).catch(noop);
    }

    async openInstallChooser(): Promise<void> {
        if (!this.device) return;
        const path = await showOpenDialog({
            filters: [{name: 'IPK package', extensions: ['ipk']}],
            defaultPath: await downloadDir(),
        }).then((result) => Array.isArray(result) ? result[0] : result);
        if (!path) {
            return;
        }
        const progress = ProgressDialogComponent.open(this.modalService);
        const component = progress.componentInstance as ProgressDialogComponent;
        try {
            await this.appManager.installByPath(this.device, path, (progress, statusText) => {
                component.progress = progress;
                component.message = statusText;
            });
        } catch (e) {
            console.warn(e);
            this.handleInstallationError(await basename(path), e as Error);
        } finally {
            progress.close(true);
        }
    }

    launchApp(id: string): void {
        if (!this.device) return;
        this.appManager.launch(this.device, id).then(noop);
    }

    async removePackage(pkg: RawPackageInfo): Promise<void> {
        if (!this.device) return;
        const confirm = MessageDialogComponent.open(this.modalService, {
            title: 'Remove App',
            message: `Remove app \"${pkg.title}\"?`,
            positive: 'Remove',
            positiveStyle: 'danger',
            negative: 'Cancel',
            autofocus: 'negative',
        });
        if (!await confirm.result.catch(() => false)) return;
        if (pkg.id === APP_ID_HBCHANNEL) {
            const doubleConfirm = MessageDialogComponent.open(this.modalService, {
                message: HbchannelRemoveComponent,
                positive: 'Yes, remove Homebrew Channel',
                positiveStyle: 'danger',
                negative: 'Cancel',
                autofocus: 'negative',
            });
            if (!await doubleConfirm.result.catch(() => false)) return;
        }
        const progress = ProgressDialogComponent.open(this.modalService);
        try {
            await this.appManager.remove(this.device, pkg.id);
            this.storageInfo?.refresh();
        } catch (e) {
            MessageDialogComponent.open(this.modalService, {
                message: `Failed to remove ${pkg.title}`,
                error: e as Error,
                positive: 'Close'
            });
        } finally {
            progress.close(true);
        }
    }

    async installPackage(item: RepositoryItem, channel: 'stable' | 'beta' = 'stable'): Promise<void> {
        const device = this.device;
        if (!device) return;
        const deviceInfo = await this.deviceManager.getDeviceInfo(device).catch(() => null);
        const hbConfig = await this.deviceManager.getHbChannelConfig(device).catch(() => undefined);
        const incompatible = deviceInfo && item.checkIncompatibility(deviceInfo, hbConfig);
        if (incompatible) {
            MessageDialogComponent.open(this.modalService, {
                title: 'Incompatible App',
                message: `App ${item.title} is not compatible with ${deviceInfo?.modelName ?? device.name}`,
                positive: 'Close',
            });
            return;
        }
        const manifest = channel === 'stable' ? item.manifest : item.manifestBeta;
        if (!manifest) {
            MessageDialogComponent.open(this.modalService, {
                title: `Failed to install ${item.title}`,
                message: `No manifest found for ${item.title} in channel ${channel}`,
                positive: 'Close',
            });
            return;
        }
        const progress = ProgressDialogComponent.open(this.modalService);
        const component = progress.componentInstance as ProgressDialogComponent;
        try {
            await this.appManager.installByManifest(device, manifest, (progress, statusText) => {
                component.progress = progress;
                component.message = statusText;
            });
            this.storageInfo?.refresh();
        } catch (e: any) {
            this.handleInstallationError(item.title, e as Error);
        } finally {
            progress.close(true);
        }
    }

    openDetails(item: RepositoryItem): void {
        const modalRef = this.modalService.open(DetailsComponent, {
            size: 'lg',
            scrollable: true,
            injector: Injector.create({
                providers: [
                    {provide: RepositoryItem, useValue: item},
                    {provide: 'device', useValue: this.device},
                ],
            }),
        });
        const component = modalRef.componentInstance as DetailsComponent;
        component.parent = this;
    }

    private handleInstallationError(name: string, e: Error) {
        MessageDialogComponent.open(this.modalService, {
            title: `Failed to install ${name}`,
            message: e.message,
            error: e,
            positive: 'Close',
        });
    }
}
