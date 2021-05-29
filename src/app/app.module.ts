import { HttpClient, HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
// NG Translate
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { AngularResizedEventModule } from 'angular-resize-event';
import { AddDeviceComponent } from './add-device/add-device.component';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { AppsComponent } from './home/apps/apps.component';
import { FilesComponent } from './home/files/files.component';
import { HomeComponent } from './home/home.component';
import { TerminalComponent } from './home/terminal/terminal.component';
import { SharedModule } from './shared/shared.module';
import { InfoComponent } from './home/info/info.component';

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
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    }),
    AngularResizedEventModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
