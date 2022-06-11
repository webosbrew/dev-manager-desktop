import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {InfoRoutingModule} from './info-routing.module';
import {InfoComponent} from "./info.component";
import {TranslateModule} from "@ngx-translate/core";


@NgModule({
  declarations: [
    InfoComponent,
  ],
  imports: [
    CommonModule,
    InfoRoutingModule,
    TranslateModule,
  ]
})
export class InfoModule {
}
