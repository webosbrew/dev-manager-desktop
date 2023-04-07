import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {InfoRoutingModule} from './info-routing.module';
import {InfoComponent} from "./info.component";
import {SharedModule} from "../shared/shared.module";
import { DevmodeCountdownPipe } from './devmode-countdown.pipe';


@NgModule({
  declarations: [
    InfoComponent,
    DevmodeCountdownPipe,
  ],
  imports: [
    CommonModule,
    InfoRoutingModule,
    SharedModule
  ]
})
export class InfoModule {
}
