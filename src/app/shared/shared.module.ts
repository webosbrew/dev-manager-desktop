import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { PageNotFoundComponent } from './components/page-not-found/page-not-found.component';
import { WebviewDirective } from './directives/';
import { AresPullUriPipe } from './pipes/ares-pull-uri.pipe';
import { MessageDialogComponent } from './components/message-dialog/message-dialog.component';

@NgModule({
  declarations: [
    PageNotFoundComponent,
    WebviewDirective,
    AresPullUriPipe,
    MessageDialogComponent,
  ],
  imports: [CommonModule, TranslateModule, FormsModule],
  exports: [TranslateModule, WebviewDirective, FormsModule, AresPullUriPipe]
})
export class SharedModule { }
