import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {TerminalRoutingModule} from './terminal-routing.module';
import {NgbDropdownModule, NgbNavModule} from "@ng-bootstrap/ng-bootstrap";
import {TerminalComponent} from "./terminal.component";
import {PtyComponent} from "./pty/pty.component";
import {DumbComponent} from './dumb/dumb.component';
import {TextareaAutosizeModule} from "ngx-textarea-autosize";
import {FormsModule} from "@angular/forms";
import {SharedModule} from "../shared/shared.module";


@NgModule({
  declarations: [
    TerminalComponent,
    PtyComponent,
    DumbComponent,
  ],
  imports: [
    CommonModule,
    NgbNavModule,
    TerminalRoutingModule,
    TextareaAutosizeModule,
    NgbDropdownModule,
    FormsModule,
    SharedModule,
  ]
})
export class TerminalModule {
}
