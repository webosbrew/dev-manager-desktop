import {Component, ElementRef, Inject, OnDestroy, OnInit, Renderer2, ViewChild, ViewEncapsulation} from '@angular/core';
import {
    AppManagerService,
    DeviceInfo,
    DeviceManagerService, IncompatibleReason,
    PackageManifest,
    RepositoryItem
} from "../../core/services";
import {HttpClient} from "@angular/common/http";
import {noop, Observable, of} from "rxjs";
import {AsyncPipe, NgForOf, NgIf, NgOptimizedImage, NgSwitch, NgSwitchCase, NgSwitchDefault} from "@angular/common";
import {open} from "@tauri-apps/api/shell";
import {NgLetModule} from "ng-let";
import {NgbDropdown, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle} from "@ng-bootstrap/ng-bootstrap";
import {SharedModule} from "../../shared/shared.module";
import {Device, PackageInfo} from "../../types";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {map} from "rxjs/operators";
import {AppsComponent} from "../apps.component";
import {HomebrewChannelConfiguration} from "../../types/luna-apis";

@Component({
    selector: 'app-channel-app-details',
    standalone: true,
    imports: [
        AsyncPipe,
        NgOptimizedImage,
        NgIf,
        NgLetModule,
        NgSwitchCase,
        NgbDropdown,
        NgbDropdownItem,
        NgbDropdownMenu,
        NgbDropdownToggle,
        SharedModule,
        NgSwitch,
        NgSwitchDefault,
        NgForOf
    ],
    templateUrl: './details.component.html',
    styleUrl: './details.component.scss',
    encapsulation: ViewEncapsulation.None
})
export class DetailsComponent implements OnInit, OnDestroy {
    manifest: PackageManifest;

    fullDescriptionHtml$: Observable<string>;
    installedInfo$?: Observable<PackageInfo | null>;
    incompatible$: Observable<IncompatibleReason[] | null>;

    @ViewChild('fullDescription', {static: true})
    fullDescription!: ElementRef<HTMLElement>;

    parent?: AppsComponent;


    private unsubscribeClickListener!: () => void;

    constructor(
        public item: RepositoryItem,
        @Inject('device') public device: Device,
        private appManager: AppManagerService,
        private deviceManager: DeviceManagerService,
        private http: HttpClient,
        private renderer2: Renderer2
    ) {
        this.manifest = item.manifest!;
        this.installedInfo$ = fromPromise(this.appManager.info(device, item.id));
        this.incompatible$ = fromPromise(Promise.all([
            this.deviceManager.getDeviceInfo(device).catch(() => undefined),
            this.deviceManager.getHbChannelConfig(device).catch(() => undefined)
        ]).then(([info, hbConfig]) => item.checkIncompatibility(info, hbConfig)));
        this.fullDescriptionHtml$ = item.fullDescriptionUrl ? this.http.get(item.fullDescriptionUrl, {
            responseType: 'text'
        }) : of('');
    }

    ngOnInit(): void {
        this.unsubscribeClickListener = this.renderer2.listen(this.fullDescription.nativeElement, 'click', (event) => {
            if (event.target instanceof HTMLAnchorElement) {
                event.preventDefault();
                open(event.target.href).then(noop);
            }
        });
    }

    ngOnDestroy(): void {
        this.unsubscribeClickListener();
    }
}
