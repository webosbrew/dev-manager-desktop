import {HttpClient, HttpClientModule} from '@angular/common/http';
import {NgModule} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {BrowserModule} from '@angular/platform-browser';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
// NG Translate
import {TranslateLoader, TranslateModule} from '@ngx-translate/core';
import {TranslateHttpLoader} from '@ngx-translate/http-loader';
import {AddDeviceComponent} from './add-device/add-device.component';
import {ConnHintComponent} from './add-device/conn-hint/conn-hint.component';
import {KeyserverHintComponent} from './add-device/keyserver-hint/keyserver-hint.component';
import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {CoreModule} from './core/core.module';
import {HomeComponent} from './home/home.component';
import {CrashesComponent} from './home/info/crashes/crashes.component';
import {InfoComponent} from './home/info/info.component';
import {RenewScriptComponent} from './home/info/renew-script/renew-script.component';
import {ExternalLinkDirective} from './shared/directives';
import {SharedModule} from './shared/shared.module';
import {UpdateDetailsComponent} from './update-details/update-details.component';

import {NgLetModule} from "ng-let";

// AoT requires an exported function for factories
export function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    AddDeviceComponent,
    InfoComponent,
    KeyserverHintComponent,
    ExternalLinkDirective,
    ConnHintComponent,
    CrashesComponent,
    RenewScriptComponent,
    UpdateDetailsComponent,
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
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
