import {Component, OnDestroy, OnInit} from '@angular/core';
import {DeviceManagerService} from '../../core/services';
import {filter, firstValueFrom, Observable, Subscription} from "rxjs";
import {SessionToken} from "../../../types";


@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss']
})
export class TerminalComponent implements OnInit, OnDestroy {

  public shells: SessionToken[];

  public currentShell: string;

  private subscription: Subscription;

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
    this.subscription.unsubscribe();
  }

  closeSession(event: Event, session: SessionToken) {
    this.deviceManager.closeShellSession(session);
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  async newTab(): Promise<void> {
    const device = await firstValueFrom(this.deviceManager.selected$.pipe(filter(v => v !== null)));
    const session = await this.deviceManager.openShellSession(device);
    this.currentShell = session.key;
  }

  shellTracker(index: number, value: SessionToken): string {
    return value.key;
  }
}
