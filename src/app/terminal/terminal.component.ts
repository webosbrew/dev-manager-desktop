import {Component, NgZone, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {DeviceManagerService} from '../core/services';
import {firstValueFrom, noop, Subscription} from "rxjs";
import {Device} from "../types";
import {filter} from "rxjs/operators";
import {isNonNull} from "../shared/operators";
import {RemoteShellService, ShellInfo, ShellToken} from "../core/services/remote-shell.service";
import {ITerminalDimensions} from "xterm-addon-fit";
import {listen, UnlistenFn} from "@tauri-apps/api/event";


@Component({
  selector: 'app-terminal-host',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class TerminalComponent implements OnInit, OnDestroy {

  public shells: ShellInfo[] = [];

  public currentShell?: ShellToken;

  public termSize?: ITerminalDimensions;

  private subscription?: Subscription;

  public preferDumbShell: boolean = false;
  public pendingResize?: ITerminalDimensions;
  private unlistenFns: UnlistenFn[] = [];

  constructor(public deviceManager: DeviceManagerService, private shell: RemoteShellService, private zone: NgZone) {
  }

  async ngOnInit(): Promise<void> {
    this.shell.list().then(async (shells) => {
      this.shells = shells;
      if (shells.length) {
        this.currentShell = shells[0].token;
        return;
      }
    });
    this.unlistenFns.push(await listen('shell-info', (event) =>
      this.zone.run(() => this.updateTab(event.payload as ShellInfo))));
    this.unlistenFns.push(await listen('shell-closed', (event) =>
      this.zone.run(() => this.closeTab(event.payload as ShellToken, false))));
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    for (let unlistenFn of this.unlistenFns) {
      unlistenFn();
    }
  }

  closeTab(token: ShellToken, sendClose: boolean = true) {
    const tabIndex = this.shells.findIndex((i) => i.token === token);
    if (tabIndex >= 0) {
      this.shells.splice(tabIndex, 1);
    }
    if (this.currentShell === token) {
      this.currentShell = this.shells[tabIndex > 0 ? tabIndex - 1 : 0].token;
    }
    if (sendClose) {
      this.shell.close(token).then(noop);
    }
  }

  updateTab(info: ShellInfo) {
    const tabIndex = this.shells.findIndex((i) => i.token === info.token);
    if (tabIndex < 0) return;
    this.shells[tabIndex] = info;
  }

  async newTab(device?: Device): Promise<void> {
    const size = this.termSize;
    if (!size) {
      return;
    }
    const startWith = device ?? await firstValueFrom(this.deviceManager.selected$.pipe<Device>(filter(isNonNull)));
    const shellInfo = await this.shell.open(startWith, size.rows, size.cols, this.preferDumbShell);
    this.shells.push(shellInfo);
    this.currentShell = shellInfo.token;
  }

  shellTracker(index: number, value: ShellInfo): string {
    return value.token;
  }
}
