import {AfterViewInit, Component, ElementRef, HostListener, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Terminal} from "xterm";
import {FitAddon, ITerminalDimensions} from "xterm-addon-fit";
import {SessionToken, Shell} from "../../../../types";
import {fromEvent, Subscription} from "rxjs";
import {debounceTime} from "rxjs/operators";
import {DeviceManagerService} from "../../../core/services";

@Component({
  selector: 'app-terminal-tab',
  templateUrl: './tab.component.html',
  styleUrls: ['./tab.component.scss']
})
export class TabComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input('token')
  public token: SessionToken;
  @ViewChild('termwin')
  public termwin: ElementRef<HTMLElement>;
  term: Terminal;
  fitAddon: FitAddon;
  private shell: Shell;
  private resizeSubscription: Subscription;
  pendingResize: ITerminalDimensions = null;

  constructor(private deviceManager: DeviceManagerService) {
  }

  ngOnInit(): void {
    this.term = new Terminal({});
    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.term.onKey(({domEvent, key}) => this.shellKey(domEvent, key));

    this.resizeSubscription = fromEvent(window, 'resize').pipe(debounceTime(500)).subscribe(() => {
      this.pendingResize = null;
      this.autoResize();
    });
  }

  ngAfterViewInit(): void {
    this.term.open(this.termwin.nativeElement);
    // eslint-disable-next-line
    this.openDefaultShell().catch(e => this.connError(e));
    setTimeout(() => {
      this.autoResize();
    });
  }

  ngOnDestroy(): void {
    this.resizeSubscription.unsubscribe();
    if (this.shell) {
      this.shell = null;
    }
  }

  connError(error: Error): void {
    this.term.writeln('>>> Connection error. Press any key to reconnect.');
    this.term.writeln(`>>> ${String(error)}`);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.pendingResize = this.fitAddon.proposeDimensions();
  }

  async openDefaultShell(): Promise<void> {
    const token = this.token;
    const shell = this.deviceManager.obtainShellSession(token);
    this.shell = shell;

    if (await shell.dumb()) {
      this.term.writeln(`>>> Connected to ${token.device.name} (dumb shell).`);
      this.term.writeln('>>> Due to restriction of webOS, functionality of this shell is limited.');
      this.term.writeln('>>> Features like Ctrl+C and Tab will be unavailable.');
    } else {
      this.term.writeln(`>>> Connected to ${token.device.name}.`);
    }
    shell.listen('close', () => {
      this.term.writeln('>>> Connection closed.');
      this.shell = null;
    }).listen('data', (data: string) => {
      this.term.write(data);
    });
    this.term.write(await shell.buffer());
  }

  async shellKey(event: KeyboardEvent, key: string): Promise<void> {
    if (!this.shell || await this.shell.closed()) return;
    await this.shell.write(key);
  }

  private async autoResize() {
    this.fitAddon.fit();
    if (this.shell) {
      await this.shell.resize(this.term.rows, this.term.cols, 0, 0);
    }
  }

}
