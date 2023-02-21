import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {TerminalRoutingModule} from './terminal-routing.module';
import {NgbDropdownModule, NgbNavModule} from "@ng-bootstrap/ng-bootstrap";
import {TerminalComponent} from "./terminal.component";
import {PtyComponent} from "./pty/pty.component";
import {DumbComponent} from './dumb/dumb.component';
import {TextareaAutosizeModule} from "ngx-textarea-autosize";
import {FormsModule} from "@angular/forms";
import {SizeCalculatorComponent} from './size-calculator/size-calculator.component';
import {ITerminalOptions} from "xterm";
import {SharedModule} from "../shared/shared.module";


@NgModule({
  declarations: [
    TerminalComponent,
    PtyComponent,
    DumbComponent,
    SizeCalculatorComponent,
  ],
  exports: [
    SizeCalculatorComponent
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

export const TERMINAL_CONFIG: Partial<ITerminalOptions> = {
  fontFamily: 'var(--bs-font-monospace)',
};
