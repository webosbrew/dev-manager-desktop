import {HttpClient, HttpClientModule} from '@angular/common/http';
import {NgModule} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {BrowserModule} from '@angular/platform-browser';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
// NG Translate
import {TranslateLoader, TranslateModule} from '@ngx-translate/core';
import {TranslateHttpLoader} from '@ngx-translate/http-loader';
import {NgLetModule} from 'ng-let';
import {AddDeviceComponent} from './add-device/add-device.component';
import {ConnHintComponent} from './add-device/conn-hint/conn-hint.component';
import {KeyserverHintComponent} from './add-device/keyserver-hint/keyserver-hint.component';
import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {CoreModule} from './core/core.module';
import {AppsComponent} from './home/apps/apps.component';
import {ChannelComponent} from './home/apps/channel/channel.component';
import {InstalledComponent} from './home/apps/installed/installed.component';
import {FilesComponent} from './home/files/files.component';
import {HomeComponent} from './home/home.component';
import {CrashesComponent} from './home/info/crashes/crashes.component';
import {InfoComponent} from './home/info/info.component';
import {RenewScriptComponent} from './home/info/renew-script/renew-script.component';
import {TerminalComponent} from './home/terminal/terminal.component';
import {ExternalLinkDirective} from './shared/directives';
import {SharedModule} from './shared/shared.module';
import {UpdateDetailsComponent} from './update-details/update-details.component';
import {AttrsPermissionsPipe} from './shared/pipes/attrs-permissions.pipe';
import {NgxFilesizeModule} from 'ngx-filesize';
import {NgxDatatableModule} from '@swimlane/ngx-datatable';
import {TabComponent} from './home/terminal/tab/tab.component';

// AoT requires an exported function for factories
export function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    AddDeviceComponent,
    AppsComponent,
    FilesComponent,
    TerminalComponent,
    InfoComponent,
    KeyserverHintComponent,
    ExternalLinkDirective,
    ConnHintComponent,
    CrashesComponent,
    InstalledComponent,
    ChannelComponent,
    RenewScriptComponent,
    UpdateDetailsComponent,
    AttrsPermissionsPipe,
    TabComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    HttpClientModule,
    CoreModule,
    SharedModule,
    AppRoutingModule,
    ReactiveFormsModule,
    NgbModule,
    NgLetModule,
    NgxDatatableModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    }),
    NgxFilesizeModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
