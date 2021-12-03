import {AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {fromEvent, Subscription} from 'rxjs';
import {debounceTime} from 'rxjs/operators';
import {Terminal} from 'xterm';
import {FitAddon, ITerminalDimensions} from 'xterm-addon-fit';
import {DeviceManagerService} from '../../core/services';
import {cleanupSession} from '../../shared/util/ares-utils';


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
    this.term.onKey((arg1) => {
      if (!this.shell || this.shell.closed) {
        this.openDefaultShell().catch((err: Error) => this.connError(err));
      } else if (this.shell) {
        console.log(arg1);
        this.shell.write(arg1.key);
      }
    });

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
    const shell = await this.deviceManager.openShell(device.name);
    this.shell = shell;

    if (shell.dumb) {
      this.term.writeln(`>>> Connected to ${device.name} (dumb shell).`);
      this.term.writeln('>>> Due to restriction of webOS, functionality of this shell is limited.');
      this.term.writeln('>>> Features like Ctrl+C and Tab will be unavailable.');
    } else {
      this.term.writeln(`>>> Connected to ${device.name}.`);
    }
    this.term.writeln('');
    shell.on('close', () => {
      this.term.writeln('>>> Connection closed. Press any key to reconnect.');
      this.shell = null;
      cleanupSession();
    }).on('data', (data: Uint8Array) => {
      this.term.write(data);
    });
  }
}

interface Shell {
  readonly closed: boolean

  write(data: string): void;

  close(): void;
}
