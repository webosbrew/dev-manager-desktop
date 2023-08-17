import {Component, OnDestroy, OnInit} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {noop, Observable, Subscription} from 'rxjs';
import {Device, PackageInfo, RawPackageInfo} from '../types';
import {AppManagerService, DeviceManagerService, RepositoryItem} from '../core/services';
import {MessageDialogComponent} from '../shared/components/message-dialog/message-dialog.component';
import {ProgressDialogComponent} from '../shared/components/progress-dialog/progress-dialog.component';
import {has, keyBy} from 'lodash';
import {open as showOpenDialog} from '@tauri-apps/api/dialog';
import {basename, downloadDir} from "@tauri-apps/api/path";
import {APP_ID_HBCHANNEL} from "../shared/constants";
import {HbchannelRemoveComponent} from "./hbchannel-remove/hbchannel-remove.component";

@Component({
    selector: 'app-apps',
    templateUrl: './apps.component.html',
    styleUrls: ['./apps.component.scss']
})
export class AppsComponent implements OnInit, OnDestroy {

    packages$?: Observable<PackageInfo[] | null>;
    instPackages?: Record<string, RawPackageInfo>;
    device: Device | null = null;


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

    onDragOver(event: DragEvent): void {
        // console.log('onDragOver', event.type, event.dataTransfer.items.length && event.dataTransfer.items[0]);
        event.preventDefault();
    }

    onDragEnter(event: DragEvent): void {
        const transfer = event.dataTransfer!;
        if (transfer.items.length != 1 || transfer.items[0].kind != 'file') {
            return;
        }
        event.preventDefault();
        console.log('onDragEnter', event.type, transfer.items.length && transfer.items[0]);
    }

    onDragLeave(event: DragEvent): void {
        const dataTransfer = event.dataTransfer!;
        console.log('onDragLeave', dataTransfer.items.length && dataTransfer.items[0]);
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

    async dropFiles(event: DragEvent): Promise<void> {
        if (!this.device) return;
        const transfer = event.dataTransfer!;
        console.log('dropFiles', event, transfer.files);
        const files = transfer.files;
        if (files.length != 1 || !files[0].name.endsWith('.ipk')) {
            // Show error
            return;
        }
        const file: File = files[0];
        const progress = ProgressDialogComponent.open(this.modalService);
        const component = progress.componentInstance as ProgressDialogComponent;
        try {
            await this.appManager.installByPath(this.device, file.webkitRelativePath, this.hasHbChannel, (progress, statusText) => {
                component.progress = progress;
                component.message = statusText;
            });
        } catch (e) {
            this.handleInstallationError(file.name, e as Error);
        } finally {
            progress.close(true);
        }
    }

    async openInstallChooser(): Promise<void> {
        if (!this.device) return;
        const open = await showOpenDialog({
            filters: [{name: 'IPK package', extensions: ['ipk']}],
            defaultPath: await downloadDir(),
        });
        if (!open) {
            return;
        }
        const path = Array.isArray(open) ? open[0] : open;
        const progress = ProgressDialogComponent.open(this.modalService);
        const component = progress.componentInstance as ProgressDialogComponent;
        try {
            await this.appManager.installByPath(this.device, path, this.hasHbChannel, (progress, statusText) => {
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

    async installPackage(item: RepositoryItem): Promise<void> {
        if (!this.device) return;
        const progress = ProgressDialogComponent.open(this.modalService);
        const component = progress.componentInstance as ProgressDialogComponent;
        try {
            await this.appManager.installByManifest(this.device, item.manifest!, this.hasHbChannel, (progress, statusText) => {
                component.progress = progress;
                component.message = statusText;
            });
        } catch (e: any) {
            this.handleInstallationError(item.title, e as Error);
        } finally {
            progress.close(true);
        }
    }

    async installBetaPackage(item: RepositoryItem): Promise<void> {
        if (!this.device) return;
        const progress = ProgressDialogComponent.open(this.modalService);
        const component = progress.componentInstance as ProgressDialogComponent;
        try {
            await this.appManager.installByManifest(this.device, item.manifestBeta!, this.hasHbChannel, (progress, statusText) => {
                component.progress = progress;
                component.message = statusText;
            });
        } catch (e) {
            this.handleInstallationError(item.title, e as Error);
        } finally {
            progress.close(true);
        }
    }

    private get hasHbChannel(): boolean {
        return has(this.instPackages, APP_ID_HBCHANNEL);
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
