import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ClientChannel } from 'ssh2';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
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
  private stream: ClientChannel;
  private destroySession: () => void;

  constructor(
    private electron: ElectronService,
    private deviceManager: DeviceManagerService
  ) { }

  ngOnInit(): void {
    this.term = new Terminal({

    });
    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    // this.container = document.getElementById('termwin');
    // this.term.open(this.container);


  }

  ngAfterViewInit(): void {
    this.term.open(this.termwin.nativeElement);
    // this.fitAddon.fit();
    this.openDefaultShell();
  }

  ngOnDestroy(): void {
    if (this.stream) {
      this.stream.end();
    }
  }

  async openDefaultShell() {
    console.log('openDefaultShell');
    const device = (await this.deviceManager.list()).find(dev => dev.default);
    const session = await this.deviceManager.newSession(device.name);
    session.ssh.shell((err, stream) => {
      if (err) throw err;
      this.stream = stream;
      const disposable = this.term.onKey((arg1) => {
        stream.write(arg1.key);
      });

      stream.on('close', () => {
        this.term.writeln('\n\n\nConnection closed.');
        disposable.dispose();
        session.end();
        cleanupSession();
        console.log('SSH session cleaned up');
      }).on('data', (data) => {
        this.term.write(data);
      });

    });
  }
}
