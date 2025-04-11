import {NgModule} from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';

import {AppsRoutingModule} from './apps-routing.module';
import {AppsComponent} from "./apps.component";
import {ChannelComponent} from "./channel/channel.component";
import {InstalledComponent} from "./installed/installed.component";
import {NgbDropdownModule, NgbNavModule, NgbPaginationModule, NgbProgressbar} from "@ng-bootstrap/ng-bootstrap";
import {SharedModule} from "../shared/shared.module";
import {HbchannelRemoveComponent} from './hbchannel-remove/hbchannel-remove.component';
import {FormsModule} from "@angular/forms";

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
        NgbDropdownModule,
        NgbProgressbar,
        NgOptimizedImage,
        FormsModule,
    ]
})
export class AppsModule {
}
