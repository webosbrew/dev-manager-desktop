import {Component, Input} from '@angular/core';
import {Device} from "../../types";
import {RemoteCommandService} from "../../core/services/remote-command.service";
import {from, identity, mergeMap, Observable} from "rxjs";
import {LogMessage, RemoteLogService} from "../../core/services/remote-log.service";

@Component({
    selector: 'app-dmesg',
    templateUrl: './dmesg.component.html',
    styleUrls: ['./dmesg.component.scss']
})
export class DmesgComponent {

    logs?: Observable<LogMessage>;

    private deviceField: Device | null = null;

    constructor(private cmd: RemoteCommandService, private log: RemoteLogService) {
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

    async clearBuffer(): Promise<void> {
        const device = this.device;
        if (!device) {
            return;
        }
        await this.log.dmesgClear(device);
        this.reload(device);
    }

    private reload(device: Device) {
        this.logs = from(this.log.dmesg(device)).pipe(mergeMap(identity));
    }

}
