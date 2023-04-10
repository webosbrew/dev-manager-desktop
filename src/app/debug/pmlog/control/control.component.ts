import {Component, Inject} from '@angular/core';
import {Device} from "../../../types";
import {PrefLogLevel, RemoteLogService} from "../../../core/services/remote-log.service";
import {NgbActiveModal, NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {SetContextComponent} from "../set-context/set-context.component";

@Component({
  selector: 'app-pmlog-control',
  templateUrl: './control.component.html',
  styleUrls: ['./control.component.scss']
})
export class PmLogControlComponent {

  logLevels = LOG_LEVELS;

  constructor(
    public modal: NgbActiveModal,
    @Inject('device') public device: Device,
    @Inject('contexts') public contexts: [string, PrefLogLevel][],
    private log: RemoteLogService,
    private modals: NgbModal) {
  }


  async changeLogLevel(context: string, value: string) {
    this.log.pmLogSetLevel(this.device, context, value as PrefLogLevel)
      .then(changed => this.reflectChanges(changed, value as PrefLogLevel));
  }

  async showSetLevel() {
    const result = await SetContextComponent.prompt(this.modals);
    if (!result) {
      return;
    }
    const changed = await this.log.pmLogSetLevel(this.device, result.context, result.level);
    this.reflectChanges(changed, result.level);
  }

  private reflectChanges(changed: string[], level: PrefLogLevel) {
    for (let c of changed) {
      const index = this.contexts.findIndex(v => v[0] === c);
      if (index < 0) {
        continue;
      }
      this.contexts[index][1] = level;
    }
  }
}

export const LOG_LEVELS: { level: PrefLogLevel, label: string }[] = [
  {level: "none", label: "None"},
  {level: "debug", label: "Debug"},
  {level: "info", label: "Info"},
  {level: "notice", label: "Notice"},
  {level: "warning", label: "Warning"},
  {level: "err", label: "Error"},
  {level: "crit", label: "Critical"},
  {level: "alert", label: "Alert"},
  {level: "emerg", label: "Emergency"},
]
