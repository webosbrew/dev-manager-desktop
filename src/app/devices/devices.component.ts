import {Component, Inject, Optional} from '@angular/core';
import {DeviceManagerService} from "../core/services";
import {Observable} from "rxjs";
import {Device, NewDevice} from "../types";
import {AsyncPipe, NgIf} from "@angular/common";
import {NgbActiveModal, NgbCollapse} from "@ng-bootstrap/ng-bootstrap";
import {AddDeviceModule} from "../add-device/add-device.module";
import {InlineEditorComponent} from "./inline-editor/inline-editor.component";
import {HomeComponent} from "../home/home.component";

@Component({
    selector: 'app-devices',
    standalone: true,
    imports: [
        AsyncPipe,
        NgIf,
        AddDeviceModule,
        NgbCollapse,
        InlineEditorComponent
    ],
    templateUrl: './devices.component.html',
    styleUrl: './devices.component.scss'
})
export class DevicesComponent {
    public devices$: Observable<Device[] | null>;

    editingDevice: Device | undefined;

    constructor(
        @Optional() @Inject(HomeComponent) public home: HomeComponent,
        public deviceManager: DeviceManagerService
    ) {
        this.devices$ = deviceManager.devices$;
    }

    editDevice(device: Device) {

    }

    deleteDevice(device: Device) {

    }

    async saveDevice(device: NewDevice) {
        await this.deviceManager.addDevice(device).then(() => {
            this.editingDevice = undefined;
        })
    }

    addDevice() {
        this.home?.openSetupDevice(true);
    }
}
