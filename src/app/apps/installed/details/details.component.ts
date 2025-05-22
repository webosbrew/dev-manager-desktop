import {Component, Inject} from '@angular/core';
import {AsyncResult, Device, PackageInfo} from "../../../types";
import {AppManagerService, PackageDiskUsage} from "../../../core/services";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {Observable} from "rxjs";
import {AsyncPipe} from "@angular/common";
import {SharedModule} from "../../../shared/shared.module";
import {FilesizePipe} from "../../../shared/pipes/filesize.pipe";
import {FileSizeOptions} from "filesize";

@Component({
    selector: 'app-details',
    standalone: true,
    imports: [
        AsyncPipe,
        SharedModule,
        FilesizePipe
    ],
    templateUrl: './details.component.html',
    styleUrl: './details.component.scss'
})
export class DetailsComponent {

    diskUsage$: Observable<AsyncResult<PackageDiskUsage, unknown>>;
    sizeOptions: FileSizeOptions = {base: 2, standard: 'jedec'};

    constructor(
        @Inject('device') public device: Device,
        @Inject('package') public pkg: PackageInfo,
        appManager: AppManagerService
    ) {
        this.diskUsage$ = fromPromise(appManager.appDiskUsage(device, pkg.folderPath)
            .then((result) => ({result})).catch((error) => ({error})));
    }
}
