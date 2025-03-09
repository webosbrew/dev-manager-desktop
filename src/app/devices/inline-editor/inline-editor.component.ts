import {Component, EventEmitter, Input, Output} from '@angular/core';
import {AddDeviceModule} from "../../add-device/add-device.module";
import {AppPrivKeyName, Device, NewDevice, NewDeviceAuthentication} from "../../types";
import {
    DeviceEditorComponent,
    OpenSshLocalKeyValue,
    SetupAuthInfoUnion
} from "../../add-device/device-editor/device-editor.component";

@Component({
    selector: 'app-device-inline-editor',
    standalone: true,
    templateUrl: './inline-editor.component.html',
    imports: [
        DeviceEditorComponent
    ],
    styleUrl: './inline-editor.component.scss'
})
export class InlineEditorComponent {
    @Input()
    device!: Device;

    @Output()
    save: EventEmitter<NewDevice> = new EventEmitter();

    @Output()
    closed: EventEmitter<void> = new EventEmitter();

    get deviceAuth(): SetupAuthInfoUnion {
        if (this.device.password) {
            return {type: NewDeviceAuthentication.Password, value: this.device.password};
        } else if (this.device.username === 'prisoner') {
            return {
                type: NewDeviceAuthentication.DevKey,
                value: this.device.passphrase!
            };
        } else if (this.device.privateKey?.openSsh === AppPrivKeyName) {
            return {
                type: NewDeviceAuthentication.AppKey,
                value: null,
            };
        } else {
            return {
                type: NewDeviceAuthentication.LocalKey,
                value: new OpenSshLocalKeyValue(this.device.privateKey!.openSsh, this.device.passphrase),
            }
        }
    }

    doSave(editor: DeviceEditorComponent) {
        editor.submit().then(dev => this.save.emit(dev));
    }
}
