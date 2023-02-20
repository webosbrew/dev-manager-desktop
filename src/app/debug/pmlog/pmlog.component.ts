import {Component, Injector, Input} from '@angular/core';
import {Device} from "../../types";
import {RemoteCommandService} from "../../core/services/remote-command.service";
import {from, identity, mergeMap, Observable} from "rxjs";
import {LogMessage, RemoteLogService} from "../../core/services/remote-log.service";
import {LogReaderComponent} from "../log-reader/log-reader.component";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {PmLogControlComponent} from "./control/control.component";
import {ProgressDialogComponent} from "../../shared/components/progress-dialog/progress-dialog.component";

@Component({
  selector: 'app-pmlog',
  templateUrl: './pmlog.component.html',
  styleUrls: ['./pmlog.component.scss']
})
export class PmLogComponent {

  logs?: Observable<LogMessage>;

  private deviceField: Device | null = null;

  constructor(private cmd: RemoteCommandService, private log: RemoteLogService, private modals: NgbModal) {
  }


  get device(): Device | null {
    return this.deviceField;
  }

  @Input()
  set device(device: Device | null) {
    this.deviceField = device;
    this.logs = undefined;
    if (device) {
      this.reload(device);
    }
  }

  private reload(device: Device) {
    this.logs = from(this.log.logread(device, LogReaderComponent.retainLogs)).pipe(mergeMap(identity));
  }

  async openCtrl(): Promise<void> {
    const device = this.device;
    if (!device) {
      return;
    }
    const progress = ProgressDialogComponent.open(this.modals);
    try {
      const contexts = await this.log.pmLogShow(device);
      this.modals.open(PmLogControlComponent, {
        injector: Injector.create({
          providers: [
            {provide: 'device', useValue: this.device},
            {provide: 'contexts', useValue: contexts}
          ]
        }),
        scrollable: true,
      });
    } finally {
      progress.close();
    }
  }

}
