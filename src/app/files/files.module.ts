import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {FilesRoutingModule} from './files-routing.module';
import {NgxFilesizeModule} from "ngx-filesize";
import {FilesComponent} from "./files.component";
import {AttrsPermissionsPipe} from "./attrs-permissions.pipe";
import {NgbTooltipModule} from "@ng-bootstrap/ng-bootstrap";
import {NgLetModule} from "ng-let";
import {FilesTableComponent} from './files-table/files-table.component';
import {SharedModule} from "../shared/shared.module";


@NgModule({
  declarations: [
    FilesComponent,
    AttrsPermissionsPipe,
    FilesTableComponent,
  ],
  imports: [
    CommonModule,
    FilesRoutingModule,
    NgxFilesizeModule,
    NgbTooltipModule,
    NgLetModule,
    SharedModule,
  ]
})
export class FilesModule {
}
