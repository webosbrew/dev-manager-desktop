import {Component, OnDestroy, OnInit} from '@angular/core';
import {DeviceManagerService} from '../core/services';
import {firstValueFrom, noop, Subscription} from "rxjs";
import {Device} from "../../../main/types";
import {filter} from "rxjs/operators";
import {isNonNull} from "../shared/operators";
import {RemoteCommandService, ShellSessionToken} from "../core/services/remote-command.service";


@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss']
})
export class TerminalComponent implements OnInit, OnDestroy {

  public shells: ShellSessionToken[] = [];

  public currentShell: string = '';

  private subscription?: Subscription;

  constructor(private deviceManager: DeviceManagerService, private cmd: RemoteCommandService) {
  }

  ngOnInit(): void {
    const shells$ = this.cmd.shells$;
    this.subscription = shells$.subscribe(shells => {
      this.shells = shells;
      if (shells.length) {
        this.currentShell = shells[0].id;
      }
    });
    firstValueFrom(shells$).then(async (shells) => {
      if (shells.length) {
        return;
      }
      await this.newTab();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  closeSession(event: Event, session: ShellSessionToken) {
    this.cmd.closeShell(session).then(noop);
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  async newTab(): Promise<void> {
    const device = await firstValueFrom(this.deviceManager.selected$.pipe<Device>(filter(isNonNull)));
    const session = await this.cmd.shell(device);
    this.currentShell = session.id;
  }

  shellTracker(index: number, value: ShellSessionToken): string {
    return value.id;
  }
}
