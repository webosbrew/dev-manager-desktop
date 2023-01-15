import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {InfoRoutingModule} from './info-routing.module';
import {InfoComponent} from "./info.component";


@NgModule({
  declarations: [
    InfoComponent,
  ],
  imports: [
    CommonModule,
    InfoRoutingModule,
  ]
})
export class InfoModule {
}
