import {ChangeDetectionStrategy, Component, Injector, NgZone, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {noop, Observable, Subject, Subscription} from 'rxjs';
import {Device, RawPackageInfo} from '../types';
import {AppManagerService, DeviceManagerService, RepositoryItem} from '../core/services';
import {MessageDialogComponent} from '../shared/components/message-dialog/message-dialog.component';
import {ProgressDialogComponent} from '../shared/components/progress-dialog/progress-dialog.component';
import {open as showOpenDialog} from '@tauri-apps/plugin-dialog';
import {basename, downloadDir} from "@tauri-apps/api/path";
import * as os from "@tauri-apps/plugin-os";
import {getCurrentWebview} from "@tauri-apps/api/webview";
import {APP_ID_HBCHANNEL} from "../shared/constants";
import {HbchannelRemoveComponent} from "./hbchannel-remove/hbchannel-remove.component";

type UnlistenFn = () => void;

@Component({
    selector: 'app-apps',
    templateUrl: './apps.component.html',
    styleUrls: ['./apps.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AppsComponent implements OnInit, OnDestroy {

    device: Device | null = null;
    devices$?: Observable<Device[] | null>;
    tabId: string = 'installed';
    dragOver = false;
    readonly storageChanged$ = new Subject<void>();

    private deviceSubscription?: Subscription;
    private unlistenDragDrop?: UnlistenFn;

    constructor(
        private modalService: NgbModal,
        private appManager: AppManagerService,
        public deviceManager: DeviceManagerService,
        private zone: NgZone,
    ) {
    }

    ngOnInit(): void {
        this.devices$ = this.deviceManager.devices$;
        this.deviceSubscription = this.devices$.subscribe(devices => {
            this.device = devices?.find(d => d.default) ?? null;
        });
        this.setupDragDrop().catch(e => console.warn('Drag-drop listener failed:', e));
    }

    ngOnDestroy(): void {
        this.deviceSubscription?.unsubscribe();
        this.unlistenDragDrop?.();
    }

    private async setupDragDrop(): Promise<void> {
        if (os.type() === 'android' || os.type() === 'ios') return;
        const webview = getCurrentWebview();
        this.unlistenDragDrop = await webview.onDragDropEvent(event => {
            this.zone.run(() => {
                switch (event.payload.type) {
                    case 'over':
                    case 'enter':
                        this.dragOver = true;
                        break;
                    case 'leave':
                        this.dragOver = false;
                        break;
                    case 'drop':
                        this.dragOver = false;
                        const ipks = event.payload.paths.filter(p => p.toLowerCase().endsWith('.ipk'));
                        for (const path of ipks) {
                            this.installFromPath(path).catch(noop);
                        }
                        break;
                }
            });
        });
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
        await this.installFromPath(path);
    }

    private async installFromPath(path: string): Promise<void> {
        if (!this.device) return;
        const progress = ProgressDialogComponent.open(this.modalService);
        const component = progress.componentInstance as ProgressDialogComponent;
        try {
            await this.appManager.installByPath(this.device, path,
                (progress, statusText) => component.update(statusText, progress));
            this.storageChanged$.next();
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
            this.storageChanged$.next();
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

    async installPackage(item: RepositoryItem, channel: 'stable' | 'beta' = 'stable', deviceOverride?: Device): Promise<boolean> {
        const device = deviceOverride ?? this.device;
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
            this.storageChanged$.next();
            return true;
        } catch (e: any) {
            this.handleInstallationError(item.title, e as Error);
            return false;
        } finally {
            progress.close(true);
        }
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
