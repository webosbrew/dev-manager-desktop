import {Component, OnInit, ViewChild} from '@angular/core';
import {DeviceManagerService, ShellInfo} from '../../core/services';
import {firstValueFrom, Observable} from "rxjs";
import {Device, SessionToken} from "../../../types";
import {NgbNav} from "@ng-bootstrap/ng-bootstrap";


@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss']
})
export class TerminalComponent implements OnInit {

  @ViewChild('ngbNav')
  nav: NgbNav;

  public shells$: Observable<SessionToken[]>;

  constructor(private deviceManager: DeviceManagerService) {
    this.shells$ = deviceManager.shells$;
  }

  ngOnInit() {
  }

  async addSession(device: Device | null) {
    if (!device) return;
    await this.deviceManager.openShellSession(device);
  }

  closeSession(event: Event, session: ShellInfo) {
    this.deviceManager.closeShellSession(session);
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  newTab() {
    firstValueFrom(this.deviceManager.selected$).then(device => this.addSession(device));
  }
}
