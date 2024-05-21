import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {PageNotFoundComponent} from './components/page-not-found/page-not-found.component';
import {TrustUriPipe} from './pipes/trust-uri.pipe';
import {MessageDialogComponent} from './components/message-dialog/message-dialog.component';
import {ProgressDialogComponent} from './components/progress-dialog/progress-dialog.component';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {MessageTraceComponent} from './components/message-dialog/message-trace/message-trace.component';
import {ErrorCardComponent} from './components/error-card/error-card.component';
import {ExternalLinkDirective, SearchBarDirective} from "./directives";
import {SizeCalculatorComponent} from "./components/term-size-calculator/size-calculator.component";
import {LoadingCardComponent} from './components/loading-card/loading-card.component';
import {StatStorageInfoComponent} from './components/stat-storage-info/stat-storage-info.component';
import {FilesizePipe} from "./pipes/filesize.pipe";

@NgModule({
    declarations: [
        PageNotFoundComponent,
        TrustUriPipe,
        FilesizePipe,
        MessageDialogComponent,
        ProgressDialogComponent,
        MessageTraceComponent,
        ErrorCardComponent,
        ExternalLinkDirective,
        SearchBarDirective,
        SizeCalculatorComponent,
        LoadingCardComponent,
        StatStorageInfoComponent,
    ],
    imports: [CommonModule, FormsModule, NgbModule],
    exports: [
        PageNotFoundComponent,
        TrustUriPipe,
        FilesizePipe,
        MessageDialogComponent,
        ProgressDialogComponent,
        MessageTraceComponent,
        ErrorCardComponent,
        ExternalLinkDirective,
        SearchBarDirective,
        SizeCalculatorComponent,
        LoadingCardComponent,
        StatStorageInfoComponent
    ]
})
export class SharedModule {
}
