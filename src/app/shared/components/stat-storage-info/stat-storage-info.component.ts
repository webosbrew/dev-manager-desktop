import {Component, Input} from '@angular/core';
import {Device, StorageInfo} from "../../../types";
import {DeviceManagerService} from "../../../core/services";
import {FileSizeOptionsBase} from "filesize";

@Component({
    selector: 'app-stat-storage-info',
    templateUrl: './stat-storage-info.component.html',
    styleUrls: ['./stat-storage-info.component.scss']
})
export class StatStorageInfoComponent {

    private deviceField: Device | null = null;
    private locationField: string | null = null;

    storage: StorageInfo | null = null;

    sizeOptions: FileSizeOptionsBase = {round: 0, standard: "jedec"};

    constructor(private service: DeviceManagerService) {

    }

    get device(): Device | null {
        return this.deviceField;
    }

    @Input()
    set device(value: Device | null) {
        const changed = this.deviceField !== value;
        this.deviceField = value;
        if (changed) {
            this.storage = null;
            this.refresh();
        }
    }

    get location(): string | null {
        return this.locationField;
    }

    @Input()
    set location(value: string | null) {
        const changed = this.locationField !== value;
        this.locationField = value;
        if (changed) {
            this.storage = null;
            this.refresh();
        }
    }

    public refresh(): void {
        const device = this.deviceField;
        if (!device) {
            return;
        }
        this.service.getStorageInfo(device, this.locationField || undefined)
            .catch(() => null).then(info => {
            if (!info) {
                return;
            }
            this.storage = info;
        });
    }
}
