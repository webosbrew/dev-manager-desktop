import {Component} from '@angular/core';
import {CrashReport} from "../../../core/services";
import {firstValueFrom} from "rxjs";
import {save as showSaveDialog} from "@tauri-apps/plugin-dialog";
import {ProgressDialogComponent} from "../../../shared/components/progress-dialog/progress-dialog.component";
import {writeTextFile} from "@tauri-apps/plugin-fs";
import {NgbActiveModal, NgbModal} from "@ng-bootstrap/ng-bootstrap";

@Component({
  selector: 'app-crash-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss']
})
export class DetailsComponent {

  constructor(public report: CrashReport, public modal: NgbActiveModal, private modals: NgbModal) {
  }

  async copyReport(report: CrashReport): Promise<void> {
    await navigator.clipboard.writeText(await firstValueFrom(report.content));
  }

  async saveReport(report: CrashReport): Promise<void> {
    let target: string | null;
    try {
      target = await showSaveDialog({
        defaultPath: `${report.saveName}.txt`,
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
