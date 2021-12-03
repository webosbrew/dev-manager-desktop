import {AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {fromEvent, Subscription} from 'rxjs';
import {debounceTime} from 'rxjs/operators';
import {Terminal} from 'xterm';
import {FitAddon, ITerminalDimensions} from 'xterm-addon-fit';
import {DeviceManagerService} from '../../core/services';
import {cleanupSession} from '../../shared/util/ares-utils';
import {Shell} from "../../../types";


@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss']
})
export class TerminalComponent implements OnInit, AfterViewInit, OnDestroy {

  term: Terminal;
  fitAddon: FitAddon;
  @ViewChild('termwin')
  public termwin: ElementRef<HTMLElement>;
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
    this.fitAddon.fit();
    this.openDefaultShell().catch((err: Error) => this.connError(err));
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
    const device = (await this.deviceManager.list()).find(dev => dev.default);
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
      this.term.writeln('>>> Connection closed. Press any key to reconnect.');
      this.shell = null;
      cleanupSession();
    }).listen('data', (data: string) => {
      this.term.write(data);
    });
  }

  async shellKey(event: KeyboardEvent, key: string): Promise<void> {
    if (!this.shell || await this.shell.closed()) {
      this.openDefaultShell().catch((err: Error) => this.connError(err));
    } else if (this.shell) {
      await this.shell.write(key);
    }
  }
}
