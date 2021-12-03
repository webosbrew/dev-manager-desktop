import {AfterViewInit, Component, ElementRef, HostListener, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Terminal} from "xterm";
import {FitAddon, ITerminalDimensions} from "xterm-addon-fit";
import {Device, Shell} from "../../../../types";
import {fromEvent, Subscription} from "rxjs";
import {debounceTime} from "rxjs/operators";
import {DeviceManagerService} from "../../../core/services";

@Component({
  selector: 'app-terminal-tab',
  templateUrl: './tab.component.html',
  styleUrls: ['./tab.component.scss']
})
export class TabComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input('device')
  public device: Device;
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
      this.fitAddon.fit();
    });
  }

  ngAfterViewInit(): void {
    this.term.open(this.termwin.nativeElement);
    // eslint-disable-next-line
    this.openDefaultShell().catch(e => this.connError(e));
    setTimeout(() => this.fitAddon.fit());
  }

  ngOnDestroy(): void {
    this.resizeSubscription.unsubscribe();
    if (this.shell) {
      this.shell.close();
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
    const device = this.device;
    const shell = await this.deviceManager.openShell(device);
    this.shell = shell;

    if (await shell.dumb()) {
      this.term.writeln(`>>> Connected to ${device.name} (dumb shell).`);
      this.term.writeln('>>> Due to restriction of webOS, functionality of this shell is limited.');
      this.term.writeln('>>> Features like Ctrl+C and Tab will be unavailable.');
    } else {
      this.term.writeln(`>>> Connected to ${device.name}.`);
    }
    this.term.writeln('');
    shell.listen('close', () => {
      this.term.writeln('>>> Connection closed.');
      this.shell = null;
    }).listen('data', (data: string) => {
      this.term.write(data);
    });
  }

  async shellKey(event: KeyboardEvent, key: string): Promise<void> {
    if (!this.shell || await this.shell.closed()) return;
    await this.shell.write(key);
  }

}
