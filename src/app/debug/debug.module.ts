import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DebugRoutingModule} from "./debug-routing.module";
import {DebugComponent} from './debug.component';
import {NgbNavModule, NgbTooltipModule} from "@ng-bootstrap/ng-bootstrap";
import {CrashesComponent} from "./crashes/crashes.component";
import {SharedModule} from "../shared/shared.module";
import { PmLogComponent } from './pmlog/pmlog.component';
import { PmLogReaderComponent } from './pmlog/pmlog-reader/pmlog-reader.component';
import {TerminalModule} from "../terminal";


@NgModule({
  declarations: [
    DebugComponent,
    CrashesComponent,
    PmLogComponent,
    PmLogReaderComponent
  ],
  imports: [
    CommonModule,
    DebugRoutingModule,
    NgbNavModule,
    NgbTooltipModule,
    SharedModule,
    TerminalModule
  ]
})
export class DebugModule {
}
