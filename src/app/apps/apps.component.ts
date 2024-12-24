import {Component, Injector, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {noop, Observable, Subscription} from 'rxjs';
import {Device, PackageInfo, RawPackageInfo} from '../types';
import {AppManagerService, DeviceManagerService, RepositoryItem} from '../core/services';
import {MessageDialogComponent} from '../shared/components/message-dialog/message-dialog.component';
import {ProgressDialogComponent} from '../shared/components/progress-dialog/progress-dialog.component';
import {keyBy} from 'lodash';
import {open as showOpenDialog} from '@tauri-apps/plugin-dialog';
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
    devices$?: Observable<Device[]|null>;
    tabId: string = 'installed';

    @ViewChild('storageInfo') storageInfo?: StatStorageInfoComponent;

    private deviceSubscription?: Subscription;
    private packagesSubscription?: Subscription;

    constructor(
        public deviceManager: DeviceManagerService,
        private modalService: NgbModal,
        private appManager: AppManagerService,
    ) {
    }

    ngOnInit(): void {
        this.devices$ = this.deviceManager.devices$;
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
            multiple: false,
            defaultPath: await downloadDir(),
        }).then(result => result);
        if (!path) {
            return;
        }
        const progress = ProgressDialogComponent.open(this.modalService);
        const component = progress.componentInstance as ProgressDialogComponent;
        try {
            await this.appManager.installByPath(this.device, path,
                (progress, statusText) => component.update(statusText, progress));
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

    async removePackage(pkg: RawPackageInfo): Promise<boolean> {
        if (!this.device) return false;
        const confirm = MessageDialogComponent.open(this.modalService, {
            title: 'Uninstall App',
            message: `Uninstall app \"${pkg.title}\"?`,
            positive: 'Uninstall',
            positiveStyle: 'danger',
            negative: 'Cancel',
            autofocus: 'negative',
        });
        if (!await confirm.result.catch(() => false)) return false;
        if (pkg.id === APP_ID_HBCHANNEL) {
            const doubleConfirm = MessageDialogComponent.open(this.modalService, {
                message: HbchannelRemoveComponent,
                positive: 'Yes, uninstall Homebrew Channel',
                positiveStyle: 'danger',
                negative: 'Cancel',
                autofocus: 'negative',
            });
            if (!await doubleConfirm.result.catch(() => false)) return false;
        }
        const progress = ProgressDialogComponent.open(this.modalService);
        try {
            await this.appManager.remove(this.device, pkg.id);
            this.storageInfo?.refresh();
            return true;
        } catch (e) {
            MessageDialogComponent.open(this.modalService, {
                message: `Failed to uninstall ${pkg.title}`,
                error: e as Error,
                positive: 'Close'
            });
            return false;
        } finally {
            progress.close(true);
        }
    }

    async installPackage(item: RepositoryItem, channel: 'stable' | 'beta' = 'stable'): Promise<boolean> {
        const device = this.device;
        if (!device) return false;
        const progress = ProgressDialogComponent.open(this.modalService);
        try {
            const installLocation = await this.appManager.findInstallLocation(device, item.id).catch(() => null);
            if (installLocation && installLocation !== 'developer') {
                MessageDialogComponent.open(this.modalService, {
                    title: `Cannot install ${item.title}`,
                    message: `Another app with the same ID is already installed. If it was install by LG Content Store, you need to uninstall it first.`,
                    positive: 'Close',
                });
                return false;
            }
            const incompatible = await this.appManager.checkIncompatibility(device, item);
            if (incompatible) {
                const incompatibleConfirm = MessageDialogComponent.open(this.modalService, {
                    title: 'Incompatible App',
                    message: `App ${item.title} is marked not compatible with ${device.name}. It may not work properly or not at all.`,
                    positive: 'Install Anyway',
                    positiveStyle: 'danger',
                    negative: 'Cancel',
                    autofocus: 'negative',
                });
                if (!await incompatibleConfirm.result.catch(() => false)) {
                    return false;
                }
            }
            const manifest = channel === 'stable' ? item.manifest : item.manifestBeta;
            if (!manifest) {
                MessageDialogComponent.open(this.modalService, {
                    title: `Failed to install ${item.title}`,
                    message: `No manifest found for ${item.title} in channel ${channel}`,
                    positive: 'Close',
                });
                return false;
            }
            const component = progress.componentInstance as ProgressDialogComponent;
            await this.appManager.installByManifest(device, manifest,
                (progress, statusText) => component.update(statusText, progress));
            this.storageInfo?.refresh();
            return true;
        } catch (e: any) {
            this.handleInstallationError(item.title, e as Error);
            return false;
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
