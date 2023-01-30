import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {InfoRoutingModule} from './info-routing.module';
import {InfoComponent} from "./info.component";
import {SharedModule} from "../shared/shared.module";


@NgModule({
  declarations: [
    InfoComponent,
  ],
    imports: [
        CommonModule,
        InfoRoutingModule,
        SharedModule,
    ]
})
export class InfoModule {
}
