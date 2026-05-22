import {Component, Host, Injector, Input, OnChanges, SimpleChanges} from '@angular/core';
import {AppsComponent} from '../apps.component';
import {Device, PackageInfo} from "../../types";
import {Observable} from "rxjs";
import {AppManagerService, AppsRepoService, RepositoryItem} from "../../core/services";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {DetailsComponent as InstalledDetailsComponent} from "./details/details.component";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";

@Component({
    selector: 'app-installed',
    templateUrl: './installed.component.html',
    styleUrls: ['./installed.component.scss']
})
export class InstalledComponent implements OnChanges {

    @Input() device: Device | null = null;

    installed$: Observable<PackageInfo[]> | undefined;

    installedError?: Error;

    repoPackages?: Record<string, RepositoryItem>;

    constructor(@Host() public parent: AppsComponent,
                private appManager: AppManagerService, private appsRepo: AppsRepoService,
                private modals: NgbModal) {
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['device']) {
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
            return packages;
        }));
    }

    openDetails(pkg: PackageInfo) {
        this.modals.open(InstalledDetailsComponent, {
            size: 'lg',
            scrollable: true,
            injector: Injector.create({
                providers: [
                    {provide: 'package', useValue: pkg},
                    {provide: 'device', useValue: this.device},
                    {provide: 'parent', useValue: this.parent},
                    {provide: 'repoPackage', useValue: this.repoPackages?.[pkg.id] ?? null},
                ]
            })
        });
    }
}
