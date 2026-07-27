import {Component} from '@angular/core';
import {NgbActiveModal} from "@ng-bootstrap/ng-bootstrap";
import {DeviceManagerService} from "../../core/services";
import { AsyncPipe } from "@angular/common";

@Component({
    selector: 'app-device-chooser',
    imports: [
    AsyncPipe
],
    templateUrl: './device-chooser.component.html',
    styleUrl: './device-chooser.component.scss'
})
export class DeviceChooserComponent {
    constructor(
        public modal: NgbActiveModal,
        public deviceManager: DeviceManagerService,
    ) {

    }

    protected readonly parent = parent;
}
