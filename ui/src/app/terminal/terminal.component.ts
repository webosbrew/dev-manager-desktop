import {Component, OnDestroy, OnInit} from '@angular/core';
import {DeviceManagerService} from '../core/services';
import {firstValueFrom, lastValueFrom, Subscription} from "rxjs";
import {Device, SessionToken} from "../../../../main/types";
import {filter} from "rxjs/operators";
import {isNonNull} from "../shared/operators";


@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss']
})
export class TerminalComponent implements OnInit, OnDestroy {

  public shells: SessionToken[] = [];

  public currentShell: string = '';

  private subscription?: Subscription;

  constructor(private deviceManager: DeviceManagerService) {
  }

  ngOnInit(): void {
    const shells$ = this.deviceManager.shells$;
    this.subscription = shells$.subscribe(shells => {
      this.shells = shells;
      if (shells.length) {
        this.currentShell = shells[0].key;
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

  closeSession(event: Event, session: SessionToken) {
    this.deviceManager.closeShellSession(session);
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  async newTab(): Promise<void> {
    const device = await firstValueFrom(this.deviceManager.selected$.pipe<Device>(filter(isNonNull)));
    const session = await this.deviceManager.openShellSession(device);
    this.currentShell = session.key;
  }

  shellTracker(index: number, value: SessionToken): string {
    return value.key;
  }
}
