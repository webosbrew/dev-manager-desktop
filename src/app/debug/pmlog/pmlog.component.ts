import {Component, HostListener, Input, OnDestroy} from '@angular/core';
import {Device} from "../../types";
import {RemoteCommandService} from "../../core/services/remote-command.service";
import {from, identity, mergeMap, Observable, Subscription} from "rxjs";
import {PmLogMessage, RemoteLogService} from "../../core/services/remote-log.service";
import {PmLogReaderComponent} from "./pmlog-reader/pmlog-reader.component";

@Component({
  selector: 'app-pmlog',
  templateUrl: './pmlog.component.html',
  styleUrls: ['./pmlog.component.scss']
})
export class PmLogComponent {

  logs?: Observable<PmLogMessage>;

  private deviceField: Device | null = null;

  constructor(private cmd: RemoteCommandService, private log: RemoteLogService) {
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
    this.logs = from(this.log.logread(device, PmLogReaderComponent.retainLogs)).pipe(mergeMap(identity));
  }

}
