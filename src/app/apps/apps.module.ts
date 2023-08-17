import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {AppsRoutingModule} from './apps-routing.module';
import {AppsComponent} from "./apps.component";
import {ChannelComponent} from "./channel/channel.component";
import {InstalledComponent} from "./installed/installed.component";
import {NgbDropdownModule, NgbNavModule, NgbPaginationModule, NgbProgressbar} from "@ng-bootstrap/ng-bootstrap";
import {SharedModule} from "../shared/shared.module";
import {NgLetModule} from "ng-let";
import { HbchannelRemoveComponent } from './hbchannel-remove/hbchannel-remove.component';
import {NgxFilesizeModule} from "ngx-filesize";

@NgModule({
  declarations: [
    AppsComponent,
    InstalledComponent,
    ChannelComponent,
    HbchannelRemoveComponent,
  ],
    imports: [
        CommonModule,
        NgbNavModule,
        NgbPaginationModule,
        AppsRoutingModule,
        SharedModule,
        NgLetModule,
        NgbDropdownModule,
        NgxFilesizeModule,
        NgbProgressbar,
    ]
})
export class AppsModule {
}
