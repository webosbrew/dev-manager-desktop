import {Component, Injector, Input} from '@angular/core';
import {CrashReport, DeviceManagerService} from '../../core/services';
import {Device} from "../../types";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {DetailsComponent} from "./details/details.component";
import {MessageDialogComponent} from "../../shared/components/message-dialog/message-dialog.component";
import {RemoteFileService} from "../../core/services/remote-file.service";
import {remove} from "lodash";

@Component({
    selector: 'app-crashes',
    templateUrl: './crashes.component.html',
    styleUrls: ['./crashes.component.scss']
})
export class CrashesComponent {

    private deviceField: Device | null = null;

    reports?: CrashReport[];
    reportsError?: Error;

    constructor(
        public deviceManager: DeviceManagerService,
        public files: RemoteFileService,
        private modals: NgbModal
    ) {
    }

    get device(): Device | null {
        return this.deviceField;
    }

    @Input()
    set device(device: Device | null) {
        this.deviceField = device;
        this.reload();
    }

    public reload() {
        if (this.deviceField) {
            this.deviceManager.listCrashReports(this.deviceField).then(reports => this.reports = reports)
                .catch(e => this.reportsError = e);
        } else {
            this.reports = undefined;
        }
    }

    openDetails(report: CrashReport) {
        this.modals.open(DetailsComponent, {
            size: 'lg',
            scrollable: true,
            injector: Injector.create({
                providers: [{
                    provide: CrashReport, useValue: report
                }]
            })
        });
    }

    async deleteReport(report: CrashReport) {
        const positive = await MessageDialogComponent.open(this.modals, {
            title: 'Delete Crash Report',
            message: `Are you sure you want to delete this crash report?`,
            positive: 'Delete',
            positiveStyle: 'danger',
            negative: 'Cancel',
        }).result.catch(() => false);
        if (!positive) {
            return;
        }
        await this.files.rm(report.device, report.path, false)
            .then(() => this.reports && remove(this.reports, r => r.path === report.path))
    }
}
