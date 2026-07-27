import {ChangeDetectionStrategy, Component, Host, HostListener, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild} from '@angular/core';
import {AppsComponent} from '../apps.component';
import {Device, PackageInfo} from "../../types";
import {Observable, Subscription} from "rxjs";
import {AppManagerService, AppsRepoService, RepositoryItem} from "../../core/services";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {NgbOffcanvas} from "@ng-bootstrap/ng-bootstrap";
import {DetailsComponent as InstalledDetailsComponent} from "./details/details.component";
import {StatStorageInfoComponent} from "../../shared/components/stat-storage-info/stat-storage-info.component";

@Component({
    selector: 'app-installed',
    templateUrl: './installed.component.html',
    styleUrls: ['./installed.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class InstalledComponent implements OnChanges, OnInit, OnDestroy {

    @Input() device: Device | null = null;

    installed$: Observable<PackageInfo[]> | undefined;

    installedError?: Error;

    repoPackages?: Record<string, RepositoryItem>;

    selectedPkg: PackageInfo | null = null;
    filterText = '';

    private static readonly NARROW_QUERY = '(max-width: 767.98px)';
    isNarrow = window.matchMedia(InstalledComponent.NARROW_QUERY).matches;

    @HostListener('window:resize')
    onResize(): void {
        const wasNarrow = this.isNarrow;
        this.isNarrow = window.matchMedia(InstalledComponent.NARROW_QUERY).matches;
        if (this.isNarrow && !wasNarrow) {
            this.selectedPkg = null;
        }
    }

    @ViewChild('storageInfo') storageInfo?: StatStorageInfoComponent;

    private storageSubscription?: Subscription;

    constructor(@Host() public parent: AppsComponent,
                private appManager: AppManagerService, private appsRepo: AppsRepoService,
                private offcanvas: NgbOffcanvas) {
    }

    ngOnInit(): void {
        this.storageSubscription = this.parent.storageChanged$.subscribe(() => {
            this.storageInfo?.refresh();
            this.loadPackages();
        });
    }

    ngOnDestroy(): void {
        this.storageSubscription?.unsubscribe();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['device']) {
            this.selectedPkg = null;
            this.loadPackages();
        }
    }

    loadPackages(): void {
        const device = this.device;
        this.installedError = undefined;
        this.repoPackages = undefined;
        if (!device) {
            this.installed$ = undefined;
            return;
        }
        this.installed$ = fromPromise(this.appManager.load(device).then(packages => {
            this.appsRepo.showApps(...packages.map(p => p.id))
                .then(repo => this.repoPackages = repo)
                .catch(() => undefined);
            this.reconcileSelection(packages);
            return packages;
        }));
    }

    selectPackage(pkg: PackageInfo): void {
        if (this.isNarrow) {
            this.openDetailsOffcanvas(pkg);
        } else {
            this.selectedPkg = pkg;
        }
    }

    private openDetailsOffcanvas(pkg: PackageInfo): void {
        if (!this.device) return;
        const device = this.device;
        const repoPackage = this.repoPackages?.[pkg.id] ?? null;
        const ref = this.offcanvas.open(InstalledDetailsComponent, {
            position: 'end',
            panelClass: 'app-detail-offcanvas',
        });
        const instance = ref.componentInstance as InstalledDetailsComponent;
        instance.pkg = pkg;
        instance.device = device;
        instance.parent = this.parent;
        instance.repoPackage = repoPackage;
        instance.ngOnChanges({
            pkg: <any>{currentValue: pkg, previousValue: undefined, firstChange: true, isFirstChange: () => true},
            device: <any>{currentValue: device, previousValue: undefined, firstChange: true, isFirstChange: () => true},
        });
    }

    matchesFilter(pkg: PackageInfo): boolean {
        if (!this.filterText) return true;
        const q = this.filterText.toLowerCase();
        return pkg.title.toLowerCase().includes(q) || pkg.id.toLowerCase().includes(q);
    }

    hasUpdate(pkg: PackageInfo): boolean {
        return this.repoPackages?.[pkg.id]?.manifest?.hasUpdate(pkg.version) === true;
    }

    private reconcileSelection(packages: PackageInfo[]): void {
        if (!this.selectedPkg) return;
        const match = packages.find(p => p.id === this.selectedPkg!.id);
        this.selectedPkg = match ?? null;
    }
}
