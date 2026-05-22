import {Component, Host, Injector, OnDestroy, OnInit} from '@angular/core';
import {Observable, Subscription} from 'rxjs';
import {AppManagerService, AppsRepoService, RepositoryItem, RepositoryPage} from '../../core/services';
import {AppsComponent} from '../apps.component';
import {PackageInfo} from "../../types";
import {DetailsComponent} from "../details/details.component";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";

@Component({
    selector: 'app-channel',
    templateUrl: './channel.component.html',
    styleUrls: ['./channel.component.scss']
})
export class ChannelComponent implements OnInit, OnDestroy {

    page = 1;
    repoPage$?: Observable<RepositoryPage>;

    installedById: Record<string, PackageInfo> = {};

    private installedSubscription?: Subscription;

    constructor(
        @Host() public parent: AppsComponent,
        private appsRepo: AppsRepoService,
        private appManager: AppManagerService,
        private modals: NgbModal) {
    }

    ngOnInit(): void {
        this.loadPage(1);
        const device = this.parent.device;
        if (device) {
            this.installedSubscription = this.appManager.packages$(device).subscribe(pkgs => {
                this.installedById = (pkgs ?? []).reduce((acc, p) => {
                    acc[p.id] = p;
                    return acc;
                }, {} as Record<string, PackageInfo>);
            });
        }
    }

    ngOnDestroy(): void {
        this.installedSubscription?.unsubscribe();
    }

    loadPage(page: number): void {
        this.repoPage$ = this.appsRepo.allApps$(page);
    }

    cardState(item: RepositoryItem): 'install' | 'installed' | 'update' {
        const inst = this.installedById[item.id];
        if (!inst) return 'install';
        return item.manifest?.hasUpdate(inst.version) === true ? 'update' : 'installed';
    }

    openDetails(item: RepositoryItem) {
        if (!this.parent.device) return;
        this.modals.open(DetailsComponent, {
            injector: Injector.create({
                providers: [
                    {provide: RepositoryItem, useValue: item},
                    {provide: 'device', useValue: this.parent.device},
                    {provide: 'parent', useValue: this.parent},
                ]
            })
        });
    }
}
