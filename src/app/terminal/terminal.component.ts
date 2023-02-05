import {Component, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {DeviceManagerService} from '../core/services';
import {firstValueFrom, noop, Subscription} from "rxjs";
import {Device} from "../types";
import {filter} from "rxjs/operators";
import {isNonNull} from "../shared/operators";
import {RemoteShellService, ShellInfo, ShellToken} from "../core/services/remote-shell.service";
import {ITerminalDimensions} from "xterm-addon-fit";


@Component({
  selector: 'app-terminal-host',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class TerminalComponent implements OnInit, OnDestroy {

  public shells: ShellInfo[] = [];

  public currentShell: string = '';

  public termSize?: ITerminalDimensions;

  private subscription?: Subscription;

  public preferDumbShell: boolean = false;
  public pendingResize?: ITerminalDimensions;

  constructor(public deviceManager: DeviceManagerService, private shell: RemoteShellService) {
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

  async newTab(device?: Device): Promise<void> {
    const size = this.termSize;
    console.log(size);
    if (!size) {
      return;
    }
    const startWith = device ?? await firstValueFrom(this.deviceManager.selected$.pipe<Device>(filter(isNonNull)));
    const shellInfo = await this.shell.open(startWith, size.rows, size.cols, this.preferDumbShell);
    this.currentShell = shellInfo.token;
  }

  shellTracker(index: number, value: ShellInfo): string {
    return value.token;
  }

  termResized(event: ITerminalDimensions) {
    console.log(event);
  }
}
