import {Component, Input} from '@angular/core';
import {CrashReport, DeviceManagerService} from '../../core/services';
import {Device} from "../../types";
import {firstValueFrom} from "rxjs";
import {save} from '@tauri-apps/api/dialog';
import {writeTextFile} from '@tauri-apps/api/fs';
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
  reportsError?: Error;

  constructor(public deviceManager: DeviceManagerService, private modals: NgbModal) {
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

  async copyReport(report: CrashReport): Promise<void> {
    await navigator.clipboard.writeText(await firstValueFrom(report.content));
  }

  async saveReport(report: CrashReport): Promise<void> {
    let target: string | null;
    try {
      target = await save({
        defaultPath: `${report.saveName}.txt`
      });
    } catch (e) {
      return;
    }
    if (!target) {
      return;
    }
    const progress = ProgressDialogComponent.open(this.modals);
    try {
      await writeTextFile(target, await firstValueFrom(report.content));
    } finally {
      progress.close();
    }
  }
}
