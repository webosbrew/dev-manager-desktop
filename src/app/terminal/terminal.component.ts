import {Component, NgZone, OnDestroy, OnInit, QueryList, ViewChildren, ViewEncapsulation} from '@angular/core';
import {DeviceManagerService} from '../core/services';
import {firstValueFrom, noop, Subscription} from "rxjs";
import {Device} from "../types";
import {filter} from "rxjs/operators";
import {isNonNull} from "../shared/operators";
import {RemoteShellService, ShellInfo, ShellToken} from "../core/services/remote-shell.service";
import {ITerminalDimensions} from "xterm-addon-fit";
import {listen, UnlistenFn, Event} from "@tauri-apps/api/event";
import {ProgressDialogComponent} from "../shared/components/progress-dialog/progress-dialog.component";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {MessageDialogComponent} from "../shared/components/message-dialog/message-dialog.component";


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

    @ViewChildren('terminal')
    public terminals?: QueryList<ITerminalComponent>;

    public preferDumbShell: boolean = false;
    public pendingResize?: ITerminalDimensions;
    private unlistenFns: UnlistenFn[] = [];

    constructor(public deviceManager: DeviceManagerService, private shell: RemoteShellService,
                private zone: NgZone, private modals: NgbModal) {
    }

    async ngOnInit(): Promise<void> {
        this.shell.list().then(async (shells) => {
            this.shells = shells;
            if (shells.length) {
                this.currentShell = shells[0].token;
                return;
            }
        });
        this.unlistenFns.push(await listen('shell-info', (event: Event<ShellInfo>) =>
            this.zone.run(() => this.updateTab(event.payload))));
        this.unlistenFns.push(await listen('shell-removed', (event: Event<ShellToken>) =>
            this.zone.run(() => this.closeTab(event.payload, false))));
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
            this.currentShell = this.shells[tabIndex > 0 ? tabIndex - 1 : 0]?.token;
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
        const progress = ProgressDialogComponent.open(this.modals);
        try {
            const shellInfo = await this.shell.open(startWith, size.rows, size.cols, this.preferDumbShell);
            this.shells.push(shellInfo);
            this.currentShell = shellInfo.token;
        } catch (e) {
            MessageDialogComponent.open(this.modals, {
                title: 'Failed to open terminal',
                message: 'Please make sure the TV was turned on. For some cases, you will need to wait one minute or two for SSH to be available.',
                error: e as Error,
                positive: 'Close'
            });
        } finally {
            progress.close();
        }
    }

    shellTracker(_index: number, value: ShellInfo): string {
        return value.token;
    }

    focusShell(shell: ShellInfo) {
        const match = this.terminals?.find(item => item.token === shell.token);
        if (!match) {
            return;
        }
        match.focus();
    }
}

export interface ITerminalComponent {
    readonly token: ShellToken;

    focus(): void;
}
