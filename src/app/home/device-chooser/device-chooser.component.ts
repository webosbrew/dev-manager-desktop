import {Component} from '@angular/core';
import {NgbActiveModal} from "@ng-bootstrap/ng-bootstrap";
import {DeviceManagerService} from "../../core/services";
import {AsyncPipe, NgForOf} from "@angular/common";

@Component({
    selector: 'app-device-chooser',
    standalone: true,
    imports: [
        AsyncPipe,
        NgForOf
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
