import {Component, ElementRef, Inject, OnDestroy, OnInit, Renderer2, ViewChild, ViewEncapsulation} from '@angular/core';
import {AppManagerService, DeviceManagerService, IncompatibleReason, PackageManifest, RepositoryItem} from "../../core/services";
import {noop, Observable, of} from "rxjs";
import {AsyncPipe, NgForOf, NgIf, NgOptimizedImage, NgSwitch, NgSwitchCase} from "@angular/common";
import {open as openPath} from "@tauri-apps/plugin-shell";
import {
    NgbActiveOffcanvas,
    NgbDropdown,
    NgbDropdownItem,
    NgbDropdownMenu,
    NgbDropdownToggle
} from "@ng-bootstrap/ng-bootstrap";
import {SharedModule} from "../../shared/shared.module";
import {Device, PackageInfo} from "../../types";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {AppsComponent} from "../apps.component";
import {ExternalLinkDirective} from "../../shared/directives";

@Component({
    selector: 'app-channel-app-details',
    standalone: true,
    imports: [
        AsyncPipe,
        NgOptimizedImage,
        NgIf,
        NgSwitchCase,
        NgbDropdown,
        NgbDropdownItem,
        NgbDropdownMenu,
        NgbDropdownToggle,
        SharedModule,
        NgSwitch,NgForOf,
        ExternalLinkDirective
    ],
    templateUrl: './details.component.html',
    styleUrl: './details.component.scss',
    encapsulation: ViewEncapsulation.None
})
export class DetailsComponent implements OnInit, OnDestroy {
    manifest: PackageManifest;

    fullDescriptionHtml$: Observable<string>;
    installedInfo$?: Observable<PackageInfo | null>;
    incompatible$!: Observable<IncompatibleReason[] | null>;
    devices$: Observable<Device[] | null>;
    selectedDevice: Device;

    @ViewChild('fullDescription', {static: true})
    fullDescription!: ElementRef<HTMLElement>;

    private unsubscribeClickListener!: () => void;

    constructor(
        public offcanvas: NgbActiveOffcanvas,
        public item: RepositoryItem,
        @Inject('device') public device: Device,
        @Inject('parent') private parent: AppsComponent,
        private appManager: AppManagerService,
        private deviceManager: DeviceManagerService,
        private renderer2: Renderer2
    ) {
        this.manifest = item.manifest!;
        this.selectedDevice = device;
        this.devices$ = this.deviceManager.devices$;
        this.fullDescriptionHtml$ = item.fullDescriptionUrl ? fromPromise(fetch(item.fullDescriptionUrl)
            .then(resp => resp.text())) : of('');
        this.refreshForDevice();
    }

    onDeviceChange(name: string): void {
        let next: Device | undefined;
        this.devices$.subscribe(devices => next = devices?.find(d => d.name === name)).unsubscribe();
        if (!next) return;
        this.selectedDevice = next;
        this.refreshForDevice();
    }

    private refreshForDevice(): void {
        this.incompatible$ = fromPromise(this.appManager.checkIncompatibility(this.selectedDevice, this.item));
        this.reloadInstalledInfo();
    }

    ngOnInit(): void {
        this.unsubscribeClickListener = this.renderer2.listen(this.fullDescription.nativeElement, 'click', (event) => {
            if (event.target instanceof HTMLAnchorElement) {
                event.preventDefault();
                openPath(event.target.href).then(noop);
            }
        });
    }

    ngOnDestroy(): void {
        this.unsubscribeClickListener();
    }

    launchApp(id: string) {
        this.parent.launchApp(id);
    }

    installPackage(item: RepositoryItem, channel: 'stable' | 'beta' = 'stable') {
        this.parent.installPackage(item, channel, this.selectedDevice)
            .then((installed) => installed && this.reloadInstalledInfo());
    }

    removePackage(item: PackageInfo) {
        this.parent.removePackage(item).then((removed) => removed && this.reloadInstalledInfo());
    }

    private reloadInstalledInfo(): void {
        this.installedInfo$ = fromPromise(this.appManager.info(this.selectedDevice, this.item.id));
    }
}
