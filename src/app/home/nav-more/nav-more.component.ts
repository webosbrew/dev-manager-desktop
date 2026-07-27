import {Component, ChangeDetectionStrategy} from '@angular/core';
import {ActivatedRoute, RouterLink} from "@angular/router";
import {HomeComponent} from "../home.component";
import ReleaseInfo from '../../../release.json';
import {SharedModule} from "../../shared/shared.module";
import {ExternalLinkDirective} from "../../shared/directives";

@Component({
    selector: 'app-nav-more',
    imports: [
        RouterLink,
        SharedModule,
        ExternalLinkDirective
    ],
    templateUrl: './nav-more.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './nav-more.component.scss'
})
export class NavMoreComponent {
    homeRoute: ActivatedRoute | null;
    readonly appVersion: string;

    constructor(
        public route: ActivatedRoute,
        public parent: HomeComponent,
    ) {
        this.homeRoute = route.parent;
        this.appVersion = ReleaseInfo.version;
    }
}
