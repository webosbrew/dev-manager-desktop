import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {InfoRoutingModule} from './info-routing.module';
import {InfoComponent} from "./info.component";
import {SharedModule} from "../shared/shared.module";
import {DevmodeCountdownPipe} from './devmode-countdown.pipe';
import {NgbDropdownModule} from "@ng-bootstrap/ng-bootstrap";
import {FormsModule} from "@angular/forms";


@NgModule({
    declarations: [
        InfoComponent,
        DevmodeCountdownPipe,
    ],
    imports: [
        CommonModule,
        InfoRoutingModule,
        SharedModule,
        NgbDropdownModule,
        FormsModule,
    ]
})
export class InfoModule {
}
