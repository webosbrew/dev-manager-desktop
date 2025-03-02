import {AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {RemoteShellService, ShellObservable, ShellToken} from "../../core/services/remote-shell.service";
import {Subscription} from "rxjs";
import {Buffer} from "buffer";
import {ITerminalComponent} from "../terminal.component";

@Component({
  selector: 'app-terminal-dumb',
  templateUrl: './dumb.component.html',
  styleUrls: ['./dumb.component.scss']
})
export class DumbComponent implements OnInit, AfterViewInit, OnDestroy, ITerminalComponent {

  @Input()
  public token!: ShellToken;

  @Input()
  public readonly?: boolean;

  public shell?: ShellObservable;

  public logs: CommandLog[] = [];

  @ViewChild('container')
  public container!: ElementRef<HTMLElement>;

  @ViewChild('input')
  public input!: ElementRef<HTMLElement>;

  private subscription?: Subscription;

  constructor(private shells: RemoteShellService) {
  }

  ngOnInit(): void {
    this.shell = this.shells.obtain(this.token!);
    this.subscription = this.shell.subscribe((v) => {
      this.received(v.fd, v.data);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.focus());
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get working(): boolean {
    const lastLog = this.logs[this.logs.length - 1];
    if (!lastLog) {
      return false;
    }
    return lastLog.status === undefined;
  }

  send(command: string) {
    command = command.trim();
    if (!command) {
      return;
    }
    const id = crypto.randomUUID();
    this.logs.push({
      id: id,
      input: command,
      output: '',
    });
    this.shell?.write(`${command};echo command-${id}:$?\n`);
  }

  received(fd: number, data: Buffer) {
    const lastLog = this.logs[this.logs.length - 1];
    if (!lastLog) {
      return;
    }
    let str = data.toString('utf-8');
    const extraPrefix = `command-${lastLog.id}:`;
    const end = str.indexOf(extraPrefix);
    if (end >= 0) {
      let extraLine = str.substring(end);
      lastLog.status = Number.parseInt(extraLine.substring(extraPrefix.length));
      str = str.substring(0, end);
    }
    lastLog.output = `${lastLog.output}${str}`;
    setTimeout(() => {
      const container = this.container.nativeElement;
      container.scrollTop = container.scrollHeight;
      this.focus();
    }, 10);
  }

  focus(): void {
    this.input.nativeElement.focus();
  }
}

interface CommandLog {
  readonly id: string;
  readonly input: string;
  output: string;
  status?: number;
}
