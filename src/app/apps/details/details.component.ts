import {Component, ElementRef, Inject, OnDestroy, OnInit, Renderer2, ViewChild, ViewEncapsulation} from '@angular/core';
import {AppManagerService, IncompatibleReason, PackageManifest, RepositoryItem} from "../../core/services";
import {HttpClient} from "@angular/common/http";
import {noop, Observable, of} from "rxjs";
import {AsyncPipe, NgForOf, NgIf, NgOptimizedImage, NgSwitch, NgSwitchCase, NgSwitchDefault} from "@angular/common";
import {open as openPath} from "@tauri-apps/plugin-shell";
import {NgLetModule} from "ng-let";
import {
    NgbActiveModal,
    NgbDropdown,
    NgbDropdownItem,
    NgbDropdownMenu,
    NgbDropdownToggle
} from "@ng-bootstrap/ng-bootstrap";
import {SharedModule} from "../../shared/shared.module";
import {Device, PackageInfo} from "../../types";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {AppsComponent} from "../apps.component";

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
        public modal: NgbActiveModal,
        public item: RepositoryItem,
        @Inject('device') public device: Device,
        private appManager: AppManagerService,
        private http: HttpClient,
        private renderer2: Renderer2
    ) {
        this.manifest = item.manifest!;
        this.incompatible$ = fromPromise(this.appManager.checkIncompatibility(device, item));
        this.fullDescriptionHtml$ = item.fullDescriptionUrl ? this.http.get(item.fullDescriptionUrl, {
            responseType: 'text'
        }) : of('');
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

    installPackage(item: RepositoryItem, channel: 'stable' | 'beta' = 'stable') {
        this.parent?.installPackage(item, channel).then((installed) => installed && this.reloadInstalledInfo());
    }

    removePackage(item: PackageInfo) {
        this.parent?.removePackage(item).then((removed) => removed && this.reloadInstalledInfo());
    }

    private reloadInstalledInfo(): void {
        this.installedInfo$ = fromPromise(this.appManager.info(this.device, this.item.id));
    }
}
