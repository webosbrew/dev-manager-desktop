import {AfterViewInit, Component, OnDestroy, OnInit} from '@angular/core';
import {DeviceManagerService} from '../core/services';
import {firstValueFrom, noop, Subscription} from "rxjs";
import {Device} from "../types";
import {filter} from "rxjs/operators";
import {isNonNull} from "../shared/operators";
import {RemoteShellService, ShellInfo, ShellToken} from "../core/services/remote-shell.service";
import {ITerminalDimensions} from "xterm-addon-fit";


@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss'],
})
export class TerminalComponent implements OnInit, OnDestroy {

  public shells: ShellInfo[] = [];

  public currentShell: string = '';

  public termSize: ITerminalDimensions = {rows: 24, cols: 80};

  private subscription?: Subscription;

  constructor(private deviceManager: DeviceManagerService, private shell: RemoteShellService) {
  }

  ngOnInit(): void {
    const shells$ = this.shell.shells$;
    this.subscription = shells$.subscribe(shells => {
      this.shells = shells;
      if (shells.length) {
        this.currentShell = shells[0].token;
      }
    });
    firstValueFrom(shells$).then(async (shells) => {
      if (shells.length) {
        this.currentShell = shells[0].token;
        return;
      }
      await this.newTab();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  closeSession(event: Event, session: ShellToken) {
    this.shell.close(session).then(noop);
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  async newTab(): Promise<void> {
    const device = await firstValueFrom(this.deviceManager.selected$.pipe<Device>(filter(isNonNull)));
    const shellInfo = await this.shell.open(device);
    this.currentShell = shellInfo.token;
  }

  shellTracker(index: number, value: ShellInfo): string {
    return value.token;
  }

  termResized(event: ITerminalDimensions) {
    console.log(event);
  }
}
