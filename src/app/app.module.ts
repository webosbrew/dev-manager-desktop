import {HttpClientModule} from '@angular/common/http';
import {NgModule} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {BrowserModule} from '@angular/platform-browser';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {ConnHintComponent} from './add-device/conn-hint/conn-hint.component';
import {KeyserverHintComponent} from './add-device/keyserver-hint/keyserver-hint.component';
import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {CoreModule} from './core/core.module';
import {HomeComponent} from './home/home.component';
import {RenewScriptComponent} from './info/renew-script/renew-script.component';
import {SharedModule} from './shared/shared.module';
import {UpdateDetailsComponent} from './update-details/update-details.component';
import {NgbAccordionModule, NgbNavModule} from "@ng-bootstrap/ng-bootstrap";
import {RemoveDeviceComponent} from './remove-device/remove-device.component';
import {AddDeviceModule} from "./add-device/add-device.module";
import {NgOptimizedImage} from "@angular/common";

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    KeyserverHintComponent,
    ConnHintComponent,
    RenewScriptComponent,
    UpdateDetailsComponent,
    RemoveDeviceComponent,
  ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        FormsModule,
        HttpClientModule,
        CoreModule,
        SharedModule,
        ReactiveFormsModule,
        AppRoutingModule,
        NgbNavModule,
        NgbAccordionModule,
        AddDeviceModule,
        NgOptimizedImage,
    ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
