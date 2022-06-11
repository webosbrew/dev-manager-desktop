import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import {Terminal} from "xterm";
import {FitAddon, ITerminalDimensions} from "xterm-addon-fit";
import {SessionToken, Shell} from "../../../../../../common/types";
import {fromEvent, Subscription} from "rxjs";
import {debounceTime} from "rxjs/operators";
import {DeviceManagerService} from "../../../core/services";

@Component({
  selector: 'app-terminal-tab',
  templateUrl: './tab.component.html',
  styleUrls: ['./tab.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class TabComponent implements OnInit, AfterViewInit, OnDestroy {

  @Input('token')
  public token: SessionToken | null = null;

  @ViewChild('termwin')
  public termwin: ElementRef<HTMLElement> | null = null;

  public term: Terminal;
  public fitAddon: FitAddon;

  public pendingResize: ITerminalDimensions | null = null;

  private shell: Shell | null = null;

  private resizeSubscription?: Subscription;

  constructor(private deviceManager: DeviceManagerService) {
    this.term = new Terminal({});
    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
  }

  ngOnInit(): void {
    this.term.onKey(({domEvent, key}) => this.shellKey(domEvent, key));

    this.resizeSubscription = fromEvent(window, 'resize').pipe(debounceTime(500)).subscribe(() => {
      this.pendingResize = null;
      this.autoResize();
    });
  }

  ngAfterViewInit(): void {
    this.term.open(this.termwin!.nativeElement);
    // eslint-disable-next-line
    this.openDefaultShell().catch(e => this.connError(e));
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setTimeout(() => this.autoResize(), 30);
  }

  ngOnDestroy(): void {
    this.resizeSubscription?.unsubscribe();
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
    const token = this.token!;
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
    const dimensions = this.fitAddon.proposeDimensions();
    if (!dimensions || !dimensions.cols || !dimensions.rows) {
      return;
    }
    this.fitAddon.fit();
    if (this.shell) {
      await this.shell.resize(this.term.rows, this.term.cols, 0, 0);
    }
  }

}
