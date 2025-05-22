import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {FilesRoutingModule} from './files-routing.module';
import {FilesComponent} from "./files.component";
import {AttrsPermissionsPipe} from "./attrs-permissions.pipe";
import {
    NgbDropdown,
    NgbDropdownItem,
    NgbDropdownMenu,
    NgbDropdownToggle,
    NgbTooltipModule
} from "@ng-bootstrap/ng-bootstrap";
import {FilesTableComponent} from './files-table/files-table.component';
import {SharedModule} from "../shared/shared.module";
import {CreateDirectoryMessageComponent} from './create-directory-message/create-directory-message.component';
import {ReactiveFormsModule} from "@angular/forms";
import {FilesizePipe} from "../shared/pipes/filesize.pipe";


@NgModule({
  declarations: [
    FilesComponent,
    AttrsPermissionsPipe,
    FilesTableComponent,
    CreateDirectoryMessageComponent,
  ],
    imports: [
        CommonModule,
        FilesRoutingModule,
        NgbTooltipModule,
        SharedModule,
        NgbDropdown,
        NgbDropdownItem,
        NgbDropdownMenu,
        NgbDropdownToggle,
        ReactiveFormsModule,
        FilesizePipe,
    ]
})
export class FilesModule {
}
