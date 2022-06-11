import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {AppsRoutingModule} from './apps-routing.module';
import {AppsComponent} from "./apps.component";
import {ChannelComponent} from "./channel/channel.component";
import {InstalledComponent} from "./installed/installed.component";
import {NgbNavModule, NgbPaginationModule} from "@ng-bootstrap/ng-bootstrap";
import {TranslateLoader, TranslateModule} from "@ngx-translate/core";
import {HttpClient} from "@angular/common/http";
import {HttpLoaderFactory} from "../app.module";
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
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    }),
  ]
})
export class AppsModule {
}
