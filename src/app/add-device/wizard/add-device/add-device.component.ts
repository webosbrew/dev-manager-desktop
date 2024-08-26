import {Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {DeviceConnectionMode} from "../mode-select/mode-select.component";
import {Device, NewDeviceAuthentication} from "../../../types";
import {DeviceEditorComponent, SetupAuthInfoUnion} from "../../device-editor/device-editor.component";
import {ProgressDialogComponent} from "../../../shared/components/progress-dialog/progress-dialog.component";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {DeviceManagerService} from "../../../core/services";

@Component({
    selector: 'app-wizard-add-device',
    templateUrl: './add-device.component.html',
    styleUrls: ['./add-device.component.scss']
})
export class AddDeviceComponent implements OnInit {
    @Input()
    mode!: DeviceConnectionMode;

    @ViewChild('deviceEditor')
    deviceEditor!: DeviceEditorComponent;

    username?: string;
    port?: number;
    auth?: SetupAuthInfoUnion;

    @Output()
    deviceAdded: EventEmitter<Device> = new EventEmitter();

    constructor(private modals: NgbModal, private deviceManager: DeviceManagerService) {
    }

    ngOnInit(): void {
        switch (this.mode) {
            case DeviceConnectionMode.DevMode: {
                this.username = 'prisoner';
                this.port = 9922;
                this.auth = {type: NewDeviceAuthentication.DevKey, value: ''};
                break;
            }
            case DeviceConnectionMode.Rooted: {
                this.username = 'root';
                this.port = 22;
                break;
            }
        }
    }

    get valid(): boolean {
        return this.deviceEditor.valid;
    }

    async submit(): Promise<void> {
        const progress = ProgressDialogComponent.open(this.modals);
        try {
            const newDevice = await this.deviceEditor.submit();
            this.deviceAdded.emit(await this.deviceManager.addDevice(newDevice));
        } finally {
            progress.close();
        }
    }
}
