import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DebugRoutingModule} from "./debug-routing.module";
import {DebugComponent} from './debug.component';
import {NgbNavModule, NgbTooltipModule} from "@ng-bootstrap/ng-bootstrap";
import {CrashesComponent} from "./crashes/crashes.component";
import {SharedModule} from "../shared/shared.module";


@NgModule({
  declarations: [
    DebugComponent,
    CrashesComponent
  ],
    imports: [
        CommonModule,
        DebugRoutingModule,
        NgbNavModule,
        NgbTooltipModule,
        SharedModule
    ]
})
export class DebugModule {
}
