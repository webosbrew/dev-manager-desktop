import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {PageNotFoundComponent} from './components/page-not-found/page-not-found.component';
import {TrustUriPipe} from './pipes/trust-uri.pipe';
import {MessageDialogComponent} from './components/message-dialog/message-dialog.component';
import {ProgressDialogComponent} from './components/progress-dialog/progress-dialog.component';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {MessageTraceComponent} from './components/message-dialog/message-trace/message-trace.component';
import { ErrorCardComponent } from './components/error-card/error-card.component';

@NgModule({
  declarations: [
    PageNotFoundComponent,
    TrustUriPipe,
    MessageDialogComponent,
    ProgressDialogComponent,
    MessageTraceComponent,
    ErrorCardComponent,
  ],
  imports: [CommonModule, FormsModule, NgbModule],
    exports: [FormsModule, TrustUriPipe, ErrorCardComponent]
})
export class SharedModule {
}
