import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ClientChannel } from 'ssh2';
import { Terminal } from 'xterm';
import { FitAddon, ITerminalDimensions } from 'xterm-addon-fit';
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
  private stream: ClientChannel;
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
    this.term.onKey(() => {
      if (!this.stream || this.stream.destroyed) {
        this.openDefaultShell().catch(this.connError.bind(this));
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
    this.openDefaultShell().catch(this.connError.bind(this));
  }

  ngOnDestroy(): void {
    this.resizeSubscription.unsubscribe();
    if (this.stream) {
      this.stream.end();
      this.stream = null;
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
    session.ssh.shell((err, stream) => {
      if (err) {
        this.connError(err);
        return;
      }
      this.stream = stream;
      const disposable = this.term.onKey((arg1) => {
        stream.write(arg1.key);
      });

      this.term.writeln(`>>> Connected to ${device.name}.`);
      this.term.writeln('');
      stream.on('close', () => {
        this.term.writeln('>>> Connection closed. Press any key to reconnect.');
        disposable.dispose();
        session.end();
        this.stream = null;
        cleanupSession();
      }).on('data', (data: any) => {
        this.term.write(data);
      });
    });
  }
}
