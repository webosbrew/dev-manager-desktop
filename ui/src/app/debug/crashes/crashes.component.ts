import {Component, Input} from '@angular/core';
import {CrashReport, DeviceManagerService} from '../../core/services';
import {Device} from "../../../../../main/types";
import {lastValueFrom, noop} from "rxjs";
import {dialog, getCurrentWindow} from "@electron/remote";
import {ProgressDialogComponent} from "../../shared/components/progress-dialog/progress-dialog.component";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";

@Component({
  selector: 'app-crashes',
  templateUrl: './crashes.component.html',
  styleUrls: ['./crashes.component.scss']
})
export class CrashesComponent {

  private deviceField: Device | null = null;

  reports?: CrashReport[];

  constructor(public deviceManager: DeviceManagerService, private modals: NgbModal) {
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

  async copyReport(report: CrashReport): Promise<void> {
    await navigator.clipboard.writeText(await lastValueFrom(report.content));
  }

  async saveReport(report: CrashReport): Promise<void> {
    let target: string | undefined;
    try {
      target = await dialog.showSaveDialog(getCurrentWindow(), {
        defaultPath: `${report.saveName}.txt`
      }).then(value => value.filePath);
    } catch (e) {
      return;
    }
    if (!target) {
      return;
    }
    const progress = ProgressDialogComponent.open(this.modals);
    try {
      await this.deviceManager.saveCrashReport(report, target);
    } finally {
      progress.close();
    }
  }
}
