import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import {Terminal} from "xterm";
import {FitAddon, ITerminalDimensions} from "xterm-addon-fit";
import {fromEvent, noop, Subscription, tap} from "rxjs";
import {debounceTime, filter, map} from "rxjs/operators";
import {RemoteShellService, ShellObservable, ShellToken} from "../../core/services/remote-shell.service";
import {isNonNull} from "../../shared/operators";

@Component({
  selector: 'app-terminal-pty',
  templateUrl: './pty.component.html',
  styleUrls: ['./pty.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class PtyComponent implements OnInit, AfterViewInit, OnDestroy {

  @Input()
  public token?: ShellToken;

  @Output()
  public termSizeChanged: EventEmitter<ITerminalDimensions> = new EventEmitter<ITerminalDimensions>();

  @ViewChild('termwin')
  public termwin: ElementRef<HTMLElement> | null = null;

  public term: Terminal;
  public fitAddon: FitAddon;

  public pendingResize?: ITerminalDimensions;

  private shell: ShellObservable | null = null;

  private resizeSubscription?: Subscription;

  constructor(private shells: RemoteShellService) {
    this.term = new Terminal({
      scrollback: 1000,
    });
    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
  }

  ngOnInit(): void {
    this.term.onData((data) => this.shellData(data));
    this.term.onKey(({domEvent}) => this.shellKey(domEvent));

    this.resizeSubscription = fromEvent(window, 'resize')
      .pipe(
        map(() => this.fitAddon.proposeDimensions()),
        filter(isNonNull),
        tap((size) => this.pendingResize = size),
        debounceTime(500)
      ).subscribe(() => {
        this.pendingResize = undefined;
        this.autoResize().then(noop);
      });
  }

  ngAfterViewInit(): void {
    this.term.open(this.termwin!.nativeElement);
    const token = this.token;
    if (token) {
      // eslint-disable-next-line
      this.openDefaultShell(token).catch(e => this.connError(e));
    }
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
    console.log(error);
    this.term.writeln('>>> Connection error. Press any key to reconnect.');
    this.term.writeln(`>>> ${String(error)}`);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.pendingResize = this.fitAddon.proposeDimensions();
  }

  async openDefaultShell(token: ShellToken): Promise<void> {
    const shell = this.shells.obtain(token);
    this.shell = shell;
    const cols = this.term.cols, rows = this.term.rows;
    this.term.reset();
    const screen = await shell.screen(rows, cols);
    console.log(screen);
    let firstLine = true;
    for (let row of screen.rows) {
      if (!firstLine) {
        this.term.write('\r\n');
      }
      this.term.write(row);
      firstLine = false;
    }
    shell.subscribe((data) => {
      this.term.write(data);
    }, (error) => {
      console.log('shell error', error);
    }, () => {
      console.log('shell close');
    });
  }

  async shellData(key: string): Promise<void> {
    // if (!this.shell || await this.shell.closed) return;
    await this.shell?.write(key);
  }

  async shellKey(event: KeyboardEvent): Promise<void> {
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

  private async autoResize() {
    const dimensions = this.fitAddon.proposeDimensions();
    if (!dimensions || !dimensions.cols || !dimensions.rows) {
      return;
    }
    this.termSizeChanged.next(dimensions);
    this.fitAddon.fit();
    if (this.shell) {
      await this.shell.resize(this.term.rows, this.term.cols);
    }
  }

}
