import {Component, Inject} from '@angular/core';
import {AsyncResult, Device, PackageInfo} from "../../../types";
import {AppManagerService, PackageDiskUsage, RepositoryItem} from "../../../core/services";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {Observable} from "rxjs";
import {AsyncPipe} from "@angular/common";
import {NgbActiveModal} from "@ng-bootstrap/ng-bootstrap";
import {SharedModule} from "../../../shared/shared.module";
import {FilesizePipe} from "../../../shared/pipes/filesize.pipe";
import {FileSizeOptions} from "filesize";
import {AppsComponent} from "../../apps.component";

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
        @Inject('parent') private parent: AppsComponent,
        @Inject('repoPackage') public repoPackage: RepositoryItem | null,
        public modal: NgbActiveModal,
        appManager: AppManagerService
    ) {
        this.diskUsage$ = fromPromise(appManager.appDiskUsage(device, pkg.folderPath)
            .then((result) => ({result})).catch((error) => ({error})));
    }

    get hasUpdate(): boolean {
        return this.repoPackage?.manifest?.hasUpdate(this.pkg.version) === true;
    }

    launch(): void {
        this.parent.launchApp(this.pkg.id);
        this.modal.close();
    }

    async uninstall(): Promise<void> {
        const removed = await this.parent.removePackage(this.pkg);
        if (removed) {
            this.modal.close();
        }
    }

    async update(): Promise<void> {
        if (!this.repoPackage) return;
        const installed = await this.parent.installPackage(this.repoPackage);
        if (installed) {
            this.modal.close();
        }
    }
}
