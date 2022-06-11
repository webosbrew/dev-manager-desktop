import {Component, Inject, OnInit} from '@angular/core';
import {NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import {CrashReport, DeviceManagerService} from '../../../core/services';
import {Device} from "../../../../../../common/types";

@Component({
  selector: 'app-crashes',
  templateUrl: './crashes.component.html',
  styleUrls: ['./crashes.component.scss']
})
export class CrashesComponent implements OnInit {

  reports?: CrashReport[];

  constructor(
    public modal: NgbActiveModal,
    public deviceManager: DeviceManagerService,
    @Inject('device') private device: Device
  ) {
  }

  ngOnInit(): void {
    this.deviceManager.listCrashReports(this.device.name).then(reports => {
      this.reports = reports;
    });
  }

}
