import {Component, Input, OnChanges, Optional, SimpleChanges} from '@angular/core';
import {AsyncResult, Device, PackageInfo} from "../../../types";
import {AppManagerService, PackageDiskUsage, RepositoryItem} from "../../../core/services";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {Observable, of} from "rxjs";
import {AsyncPipe} from "@angular/common";
import {NgbActiveOffcanvas} from "@ng-bootstrap/ng-bootstrap";
import {SharedModule} from "../../../shared/shared.module";
import {FilesizePipe} from "../../../shared/pipes/filesize.pipe";
import {FileSizeOptions} from "filesize";
import {AppsComponent} from "../../apps.component";

@Component({
    selector: 'app-installed-details',
    standalone: true,
    imports: [
        AsyncPipe,
        SharedModule,
        FilesizePipe
    ],
    templateUrl: './details.component.html',
    styleUrl: './details.component.scss'
})
export class DetailsComponent implements OnChanges {

    @Input() pkg!: PackageInfo;
    @Input() device!: Device;
    @Input() parent!: AppsComponent;
    @Input() repoPackage: RepositoryItem | null = null;

    diskUsage$: Observable<AsyncResult<PackageDiskUsage, unknown>> = of({});
    sizeOptions: FileSizeOptions = {base: 2, standard: 'jedec'};

    constructor(private appManager: AppManagerService,
                @Optional() public offcanvas: NgbActiveOffcanvas | null) {
    }

    close(): void {
        this.offcanvas?.dismiss();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['pkg'] || changes['device']) {
            this.diskUsage$ = this.pkg && this.device
                ? fromPromise(this.appManager.appDiskUsage(this.device, this.pkg.folderPath)
                    .then((result) => ({result})).catch((error) => ({error})))
                : of({});
        }
    }

    get hasUpdate(): boolean {
        return this.repoPackage?.manifest?.hasUpdate(this.pkg.version) === true;
    }

    launch(): void {
        this.parent.launchApp(this.pkg.id);
        this.offcanvas?.dismiss();
    }

    async uninstall(): Promise<boolean> {
        const removed = await this.parent.removePackage(this.pkg);
        if (removed) this.offcanvas?.dismiss();
        return removed;
    }

    async update(): Promise<boolean> {
        if (!this.repoPackage) return false;
        const installed = await this.parent.installPackage(this.repoPackage);
        if (installed) this.offcanvas?.dismiss();
        return installed;
    }

    get sourceUrl(): string | undefined {
        return this.repoPackage?.manifest?.sourceUrl;
    }
}
