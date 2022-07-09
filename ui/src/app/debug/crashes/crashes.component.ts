import {Component, Input} from '@angular/core';
import {CrashReport, DeviceManagerService} from '../../core/services';
import {Device} from "../../../../../main/types";

@Component({
  selector: 'app-crashes',
  templateUrl: './crashes.component.html',
  styleUrls: ['./crashes.component.scss']
})
export class CrashesComponent {

  private deviceField: Device | null = null;

  reports?: CrashReport[];

  constructor(public deviceManager: DeviceManagerService) {
  }

  get device(): Device | null {
    return this.deviceField;
  }

  @Input()
  set device(device: Device | null) {
    this.deviceField = device;
    if (device) {
      this.deviceManager.listCrashReports(device).then(reports => this.reports = reports);
    } else {
      this.reports = undefined;
    }
  }

}
