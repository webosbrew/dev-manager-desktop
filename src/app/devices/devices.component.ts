import {Component, Inject, Optional} from '@angular/core';
import {DeviceManagerService} from "../core/services";
import {Observable} from "rxjs";
import {Device, NewDevice} from "../types";
import {AsyncPipe} from "@angular/common";
import {NgbCollapse, NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {AddDeviceModule} from "../add-device/add-device.module";
import {InlineEditorComponent} from "./inline-editor/inline-editor.component";
import {HomeComponent} from "../home/home.component";
import {RemoveConfirmation, RemoveDeviceComponent} from "../remove-device/remove-device.component";

@Component({
    selector: 'app-devices',
    standalone: true,
    imports: [
        AsyncPipe,
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
        public deviceManager: DeviceManagerService,
        private modals: NgbModal,
    ) {
        this.devices$ = deviceManager.devices$;
    }

    async deleteDevice(device: Device) {
        let answer: RemoveConfirmation;
        try {
            let a = await RemoveDeviceComponent.confirm(this.modals, device);
            if (!a) {
                return;
            }
            answer = a;
        } catch (e) {
            return;
        }
        await this.deviceManager.removeDevice(device.name, answer.deleteSshKey);
        this.editingDevice = undefined;
    }

    async saveDevice(device: NewDevice) {
        await this.deviceManager.addDevice(device);
        this.editingDevice = undefined;
    }

    addDevice() {
        this.home?.openSetupDevice(true);
    }
}
