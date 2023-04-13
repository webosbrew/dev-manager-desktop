import {AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {IDisposable, Terminal} from "xterm";
import {ITerminalDimensions} from "xterm-addon-fit";
import {RemoteShellService, ShellObservable, ShellToken} from "../../core/services/remote-shell.service";
import {AppWebLinksAddon} from "../../shared/xterm/web-links";
import {TERMINAL_CONFIG} from "../../shared/xterm/config";
import {NgbNav} from "@ng-bootstrap/ng-bootstrap";
import {ITerminalComponent} from "../terminal.component";

@Component({
  selector: 'app-terminal-pty',
  templateUrl: './pty.component.html',
  styleUrls: ['./pty.component.scss'],
})
export class PtyComponent implements OnInit, AfterViewInit, OnDestroy, ITerminalComponent {

  @Input()
  public token!: ShellToken;

  @Input()
  public readonly?: boolean;

  @ViewChild('termwin')
  public termwin!: ElementRef<HTMLElement>;

  public term: Terminal;

  private shell: ShellObservable | null = null;

  private termListeners: IDisposable[] = [];

  constructor(private shells: RemoteShellService) {
    this.term = new Terminal({
      scrollback: 1000,
      ...TERMINAL_CONFIG,
    });
    this.term.loadAddon(new AppWebLinksAddon());
  }

  get size(): ITerminalDimensions {
    return {rows: this.term.rows, cols: this.term.cols};
  }

  @Input()
  set size(size: ITerminalDimensions) {
    this.term.resize(size.cols, size.rows);
  }

  ngOnInit(): void {
    this.termListeners.push(this.term.onData((data) => this.sendData(data)));
    this.termListeners.push(this.term.onKey(({domEvent}) => this.sendKey(domEvent)));
    this.termListeners.push(this.term.onResize((size) => this.shell?.resize(size.rows, size.cols)));
  }

  ngAfterViewInit(): void {
    this.term.open(this.termwin.nativeElement);
    const token = this.token;
    if (token) {
      this.openDefaultShell(token).catch(e => this.connError(e));
    }
    setTimeout(() => this.focus());
  }

  ngOnDestroy(): void {
    for (let l of this.termListeners) {
      l.dispose();
    }
    if (this.shell) {
      this.shell = null;
    }
  }

  connError(error: Error): void {
    console.log(error);
    this.term.writeln('>>> Connection error. Press any key to reconnect.');
    this.term.writeln(`>>> ${String(error)}`);
  }

  focus() {
    this.term.focus();
  }

  async openDefaultShell(token: ShellToken): Promise<void> {
    const shell = this.shells.obtain(token);
    this.shell = shell;
    const cols = this.term.cols, rows = this.term.rows;
    const screen = await shell.screen(rows, cols);
    if (screen.data) {
      await this.recvData(screen.data);
    } else if (screen.rows) {
      let firstLine = true;
      for (let row of screen.rows) {
        if (!firstLine) {
          await this.recvData('\r\n');
        }
        await this.recvData(row);
        firstLine = false;
      }
    }
    shell.subscribe((buffer) => {
      this.term.write(buffer.data);
    }, (error) => {
      console.log('shell error', error);
    }, () => {
      console.log('shell close');
    });
  }

  async recvData(data: string | Uint8Array, lineBreak: boolean = false): Promise<void> {
    return new Promise((resolve) => {
      if (lineBreak) {
        this.term.writeln(data, resolve);
      } else {
        this.term.write(data, resolve);
      }
    });
  }

  async sendData(key: string): Promise<void> {
    // if (!this.shell || await this.shell.closed) return;
    await this.shell?.write(key);
  }

  async sendKey(event: KeyboardEvent): Promise<void> {
    if (
      (event.key === 'Insert' && event.shiftKey) ||
      (event.key === 'v' && event.ctrlKey)
    ) {
      const text = await navigator.clipboard.readText();
      console.info('pasting text', text);
      await this.shell?.write(text);
    } else if (
      (event.key === 'Insert' && event.ctrlKey) ||
      (event.key === 'c' && event.ctrlKey && event.shiftKey)
    ) {
      const text = this.term.getSelection();
      console.info('copying text', text);
      await navigator.clipboard.writeText(text);
    }
  }

}
