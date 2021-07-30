import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ClientChannel } from 'ssh2';
import { Terminal } from 'xterm';
import { FitAddon, ITerminalDimensions } from 'xterm-addon-fit';
import { Session } from '../../../types/novacom';
import { DeviceManagerService } from '../../core/services/device-manager.service';
import { ElectronService } from '../../core/services/electron.service';
import { cleanupSession } from '../../shared/util/ares-utils';


@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss']
})
export class TerminalComponent implements OnInit, AfterViewInit, OnDestroy {

  term: Terminal;
  fitAddon: FitAddon;
  @ViewChild('termwin')
  termwin: ElementRef<HTMLElement>;
  private shell: Shell;
  private resizeSubscription: Subscription;
  pendingResize: ITerminalDimensions = null;

  constructor(
    private electron: ElectronService,
    private deviceManager: DeviceManagerService
  ) { }

  ngOnInit(): void {
    this.term = new Terminal({

    });
    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.term.onKey((arg1) => {
      if (!this.shell || this.shell.closed) {
        this.openDefaultShell().catch(() => this.openFakeShell()).catch(this.connError.bind(this));
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
    this.openDefaultShell().catch(() => this.openFakeShell()).catch(this.connError.bind(this));
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
    const session = await this.deviceManager.newSession(device.name);
    const shell: () => Promise<ClientChannel> = this.electron.util.promisify(session.ssh.shell.bind(session.ssh));
    const stream = await shell();
    this.shell = new RealShell(stream);

    this.term.writeln(`>>> Connected to ${device.name}.`);
    this.term.writeln('');
    stream.on('close', () => {
      this.term.writeln('>>> Connection closed. Press any key to reconnect.');
      session.end();
      this.shell = null;
      cleanupSession();
    }).on('data', (data: any) => {
      this.term.write(data);
    });
  }

  async openFakeShell(): Promise<void> {
    const device = (await this.deviceManager.list()).find(dev => dev.default);
    const session = await this.deviceManager.newSession(device.name);
    const exec: (command: string) => Promise<ClientChannel> = this.electron.util.promisify(session.ssh.exec.bind(session.ssh));
    const stream = await exec('sh');
    this.shell = new SimulateShell(this.term, stream);

    this.term.writeln(`>>> Connected to ${device.name} (dumb shell).`);
    this.term.writeln('>>> Due to restriction of webOS, functionality of this shell is limited.');
    this.term.writeln('>>> Features like Ctrl+C and Tab will be unavailable.');
    this.term.writeln('');
    stream.on('close', () => {
      this.term.writeln('>>> Connection closed. Press any key to reconnect.');
      session.end();
      this.shell = null;
      cleanupSession();
    }).on('data', (data: Buffer) => {
      this.term.write(data.toString('utf-8').replace(/\n/g, '\n\r'));
    });
    stream.stderr.on('data', (data: Buffer) => {
      this.term.write(data.toString('utf-8').replace(/\n/g, '\n\r'));
    });
  }
}

interface Shell {
  readonly closed: boolean
  write(data: string): void;
  close(): void;
}

class RealShell implements Shell {
  constructor(private stream: ClientChannel) { }

  get closed(): boolean {
    return this.stream.destroyed;
  }

  write(data: string): void {
    this.stream.write(data);
  }

  close(): void {
    this.stream.end();
  }
}

class SimulateShell implements Shell {
  private linebuf = '';
  private running = false;
  constructor(private term: Terminal, private stream: ClientChannel) { }

  get closed(): boolean {
    return this.stream.destroyed;
  }

  write(data: string): void {
    if (this.running) {
      if (data == '\r') {
        this.stream.write('\n', 'utf-8');
      } else {
        this.stream.write(data, 'utf-8');
      }
      return;
    }
    switch (data) {
      case '\r': {
        this.term.writeln(data);
        this.stream.write(this.linebuf.trim());
        this.stream.write('\n');
        this.linebuf = '';
        break;
      }
      case '\u0003': { // Ctrl+C
        this.term.writeln('\r');
        this.stream.write('\n');
        this.linebuf = '';
        break;
      }
      case '\u007F': {
        if (!this.linebuf) return;
        // Backspace (DEL)
        // Do not delete the prompt
        this.linebuf = this.linebuf.slice(0, -1);
        this.term.write('\b \b');
        break;
      }
      case '\u001b[A':
      case '\u001b[B':
      case '\u001b[C':
      case '\u001b[D': {
        // Arrows
        break;
      }
      case '\t': {
        break;
      }
      default: {
        this.linebuf += data;
        this.term.write(data);
        break;
      }
    }
  }

  close(): void {
    this.stream.end();
  }

}
