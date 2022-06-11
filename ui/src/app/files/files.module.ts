import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {FilesRoutingModule} from './files-routing.module';
import {NgxFilesizeModule} from "ngx-filesize";
import {FilesComponent} from "./files.component";
import {AttrsPermissionsPipe} from "./attrs-permissions.pipe";


@NgModule({
  declarations: [
    FilesComponent,
    AttrsPermissionsPipe,
  ],
  imports: [
    CommonModule,
    FilesRoutingModule,
    NgxFilesizeModule,
  ]
})
export class FilesModule {
}
