import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DebugRoutingModule} from "./debug-routing.module";
import {DebugComponent} from './debug.component';
import {NgbNavModule} from "@ng-bootstrap/ng-bootstrap";
import {CrashesComponent} from "./crashes/crashes.component";


@NgModule({
  declarations: [
    DebugComponent,
    CrashesComponent
  ],
  imports: [
    CommonModule,
    DebugRoutingModule,
    NgbNavModule
  ]
})
export class DebugModule {
}
