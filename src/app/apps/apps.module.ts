import {NgModule} from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';

import {AppsRoutingModule} from './apps-routing.module';
import {AppsComponent} from "./apps.component";
import {ChannelComponent} from "./channel/channel.component";
import {InstalledComponent} from "./installed/installed.component";
import {NgbDropdownModule, NgbNavModule, NgbPaginationModule, NgbProgressbar} from "@ng-bootstrap/ng-bootstrap";
import {SharedModule} from "../shared/shared.module";
import {NgLetModule} from "ng-let";
import {HbchannelRemoveComponent} from './hbchannel-remove/hbchannel-remove.component';

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
        NgbProgressbar,
        NgOptimizedImage,
    ]
})
export class AppsModule {
}
