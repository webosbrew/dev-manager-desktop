import {Component, Injector, Input} from '@angular/core';
import {CrashReport, DeviceManagerService} from '../../core/services';
import {Device} from "../../types";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {DetailsComponent} from "./details/details.component";

@Component({
  selector: 'app-crashes',
  templateUrl: './crashes.component.html',
  styleUrls: ['./crashes.component.scss']
})
export class CrashesComponent {

  private deviceField: Device | null = null;

  reports?: CrashReport[];
  reportsError?: Error;

  constructor(
    public deviceManager: DeviceManagerService,
    private modals: NgbModal
  ) {
  }

  get device(): Device | null {
    return this.deviceField;
  }

  @Input()
  set device(device: Device | null) {
    this.deviceField = device;
    this.reload();
  }

  public reload() {
    if (this.deviceField) {
      this.deviceManager.listCrashReports(this.deviceField).then(reports => this.reports = reports)
        .catch(e => this.reportsError = e);
    } else {
      this.reports = undefined;
    }
  }

  openDetails(report: CrashReport) {
    this.modals.open(DetailsComponent, {
      size: 'lg',
      scrollable: true,
      injector: Injector.create({
        providers: [{
          provide: CrashReport, useValue: report
        }]
      })
    });
  }
}
