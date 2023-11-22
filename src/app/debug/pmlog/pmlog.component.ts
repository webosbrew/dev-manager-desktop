import {Component, Injector, Input} from '@angular/core';
import {Device} from "../../types";
import {RemoteCommandService} from "../../core/services/remote-command.service";
import {catchError, from, identity, mergeMap, Observable, tap} from "rxjs";
import {LogMessage, RemoteLogService} from "../../core/services/remote-log.service";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {PmLogControlComponent} from "./control/control.component";
import {ProgressDialogComponent} from "../../shared/components/progress-dialog/progress-dialog.component";
import {DeviceManagerService} from "../../core/services";
import {RemoteLunaService} from "../../core/services/remote-luna.service";
import semver from "semver/preload";

@Component({
    selector: 'app-pmlog',
    templateUrl: './pmlog.component.html',
    styleUrls: ['./pmlog.component.scss']
})
export class PmLogComponent {

    logs?: Observable<LogMessage>;
    logError?: Error;
    hasData?: boolean;

    private deviceField: Device | null = null;

    constructor(private cmd: RemoteCommandService, private log: RemoteLogService,
                private luna: RemoteLunaService, private deviceManager: DeviceManagerService,
                private modals: NgbModal) {
    }


    get device(): Device | null {
        return this.deviceField;
    }

    @Input()
    set device(device: Device | null) {
        this.deviceField = device;
        this.logs = undefined;
        if (device) {
            this.reload(device);
        }
    }

    private reload(device: Device) {
        this.logError = undefined;
        this.hasData = undefined;
        this.logs = from(this.logRead(device)).pipe(mergeMap(identity), tap(() => {
            if (this.hasData === undefined) {
                this.hasData = true;
            }
        }), catchError(err => {
            this.logError = err;
            if (this.hasData === undefined) {
                this.hasData = false;
            }
            throw err;
        }));
    }

    private async logRead(device: Device): Promise<Observable<LogMessage>> {
        const info = await this.deviceManager.getDeviceInfo(device);
        if (semver.satisfies(info.osVersion || '', '>=4.0')) {
            await this.luna.call(device, 'luna://com.webos.service.config/setConfigs', {configs: {"system.collectDevLogs": true}}, false);
        } else if (semver.satisfies(info.osVersion || '', '>=2.0')) {
            await this.luna.call(device, 'luna://com.webos.pmlogd/setdevlogstatus', {recordDevLogs: true}, false);
        }
        return this.log.logread(device, 100);
    }

    async openCtrl(): Promise<void> {
        const device = this.device;
        if (!device) {
            return;
        }
        const progress = ProgressDialogComponent.open(this.modals);
        try {
            const contexts = await this.log.pmLogShow(device);
            this.modals.open(PmLogControlComponent, {
                injector: Injector.create({
                    providers: [
                        {provide: 'device', useValue: this.device},
                        {provide: 'contexts', useValue: contexts}
                    ]
                }),
                scrollable: true,
            });
        } finally {
            progress.close();
        }
    }

    async clearBuffer(): Promise<void> {
        const device = this.device;
        if (!device) {
            return;
        }
        await this.log.logClear(device);
        this.reload(device);
    }
}
