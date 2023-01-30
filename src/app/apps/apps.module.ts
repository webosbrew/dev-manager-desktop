import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {AppsRoutingModule} from './apps-routing.module';
import {AppsComponent} from "./apps.component";
import {ChannelComponent} from "./channel/channel.component";
import {InstalledComponent} from "./installed/installed.component";
import {NgbDropdownModule, NgbNavModule, NgbPaginationModule} from "@ng-bootstrap/ng-bootstrap";
import {SharedModule} from "../shared/shared.module";
import {NgLetModule} from "ng-let";

@NgModule({
  declarations: [
    AppsComponent,
    InstalledComponent,
    ChannelComponent,
  ],
  imports: [
    CommonModule,
    NgbNavModule,
    NgbPaginationModule,
    AppsRoutingModule,
    SharedModule,
    NgLetModule,
    NgbDropdownModule,
  ]
})
export class AppsModule {
}
