import {Component} from '@angular/core';
import {ActivatedRoute, RouterLink} from "@angular/router";
import {NgIf} from "@angular/common";
import {HomeComponent} from "../home.component";
import ReleaseInfo from '../../../release.json';
import {SharedModule} from "../../shared/shared.module";

@Component({
    selector: 'app-nav-more',
    standalone: true,
    imports: [
        RouterLink,
        NgIf,
        SharedModule
    ],
    templateUrl: './nav-more.component.html',
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
