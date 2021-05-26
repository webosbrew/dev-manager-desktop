import { HttpClient, HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
// NG Translate
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { DeviceSetupComponent } from './device-setup/device-setup.component';
import { InfoComponent } from './device-setup/info/info.component';
import { AppsComponent } from './home/apps/apps.component';
import { FilesComponent } from './home/files/files.component';
import { HomeComponent } from './home/home.component';
import { TerminalComponent } from './home/terminal/terminal.component';
import { SharedModule } from './shared/shared.module';
import { PrepareAccountComponent } from './device-setup/prepare-account/prepare-account.component';
import { InstallDevmodeComponent } from './device-setup/install-devmode/install-devmode.component';
import { EnableDevmodeComponent } from './device-setup/enable-devmode/enable-devmode.component';
import { EnableKeyservComponent } from './device-setup/enable-keyserv/enable-keyserv.component';
import { AutoLookupComponent } from './device-setup/auto-lookup/auto-lookup.component';

// AoT requires an exported function for factories
export function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    DeviceSetupComponent,
    InfoComponent,
    AppsComponent,
    FilesComponent,
    TerminalComponent,
    PrepareAccountComponent,
    InstallDevmodeComponent,
    EnableDevmodeComponent,
    EnableKeyservComponent,
    AutoLookupComponent,
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
    BsDropdownModule.forRoot(),
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
export class AppModule { }
