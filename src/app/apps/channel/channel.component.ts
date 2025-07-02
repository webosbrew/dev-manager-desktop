import {Component, Host, Injector, Input, OnInit} from '@angular/core';
import {Observable} from 'rxjs';
import {AppsRepoService, RepositoryItem, RepositoryPage} from '../../core/services';
import {AppsComponent} from '../apps.component';
import {RawPackageInfo} from "../../types";
import {DetailsComponent} from "../details/details.component";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";

@Component({
    selector: 'app-channel',
    templateUrl: './channel.component.html',
    styleUrls: ['./channel.component.scss']
})
export class ChannelComponent implements OnInit {

    page = 1;
    repoPage$?: Observable<RepositoryPage>;

    @Input()
    installed?: Record<string, RawPackageInfo>;

    constructor(
        @Host() public parent: AppsComponent,
        private appsRepo: AppsRepoService,
        private modals: NgbModal) {
    }

    ngOnInit(): void {
        this.loadPage(1);
    }

    loadPage(page: number): void {
        this.repoPage$ = this.appsRepo.allApps$(page);
    }

    openDetails(item: RepositoryItem) {
        this.modals.open(DetailsComponent, {
            injector: Injector.create({
                providers: [
                    {provide: RepositoryItem, useValue: item},
                ]
            })
        });
    }
}
