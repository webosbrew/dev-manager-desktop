import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { fromEvent, Observable } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ClientChannel } from 'ssh2';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
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
        this.openDefaultShell();
      }
    });

    fromEvent(window, 'resize').pipe(debounceTime(1000)).subscribe(() => {
      this.fitAddon.fit();
    });
  }

  ngAfterViewInit(): void {
    this.term.open(this.termwin.nativeElement);
    this.fitAddon.fit();
    this.openDefaultShell();
  }

  ngOnDestroy(): void {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }

  async openDefaultShell(): Promise<void> {
    const device = (await this.deviceManager.list()).find(dev => dev.default);
    const session = await this.deviceManager.newSession(device.name);
    session.ssh.shell((err, stream) => {
      if (err) throw err;
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
        console.log('SSH session cleaned up');
      }).on('data', (data) => {
        this.term.write(data);
      });

    });
  }
}
