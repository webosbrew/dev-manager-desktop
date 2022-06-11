import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {TerminalRoutingModule} from './terminal-routing.module';
import {NgbNavModule} from "@ng-bootstrap/ng-bootstrap";
import {TerminalComponent} from "./terminal.component";
import {TabComponent} from "./tab/tab.component";


@NgModule({
  declarations: [
    TerminalComponent,
    TabComponent,
  ],
  imports: [
    CommonModule,
    NgbNavModule,
    TerminalRoutingModule
  ]
})
export class TerminalModule {
}
