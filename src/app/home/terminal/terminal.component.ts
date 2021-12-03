import {Component, OnInit} from '@angular/core';
import {DeviceManagerService} from '../../core/services';
import {firstValueFrom, lastValueFrom} from "rxjs";
import {Device} from "../../../types";


@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss']
})
export class TerminalComponent implements OnInit {

  public sessions: TabSession[] = [];

  constructor(private deviceManager: DeviceManagerService) {
    const subscription = deviceManager.selected$.subscribe((device) => {
      this.addSession(device);
      subscription.unsubscribe();
    });
  }

  ngOnInit() {
  }

  addSession(device: Device | null) {
    if (!device) return;
    this.sessions.push(new TabSession(device));
  }

  closeSession(event: Event, session: TabSession) {
    const index = this.sessions.indexOf(session);
    if (index < 0) return;
    this.sessions.splice(index, 1);
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  newTab() {
    firstValueFrom(this.deviceManager.selected$).then(device => this.addSession(device));
  }
}

export class TabSession {
  title: string;

  constructor(public device: Device) {
    this.title = device.name;
  }
}
