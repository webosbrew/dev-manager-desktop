import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {PageNotFoundComponent} from './components/page-not-found/page-not-found.component';
import {AresPullUriPipe} from './pipes/ares-pull-uri.pipe';
import {MessageDialogComponent} from './components/message-dialog/message-dialog.component';
import {ProgressDialogComponent} from './components/progress-dialog/progress-dialog.component';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {MessageTraceComponent} from './components/message-dialog/message-trace/message-trace.component';

@NgModule({
  declarations: [
    PageNotFoundComponent,
    AresPullUriPipe,
    MessageDialogComponent,
    ProgressDialogComponent,
    MessageTraceComponent,
  ],
  imports: [CommonModule, FormsModule, NgbModule],
  exports: [FormsModule, AresPullUriPipe]
})
export class SharedModule {
}
