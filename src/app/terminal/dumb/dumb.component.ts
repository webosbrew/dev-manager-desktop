import {Component, ElementRef, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {RemoteShellService, ShellObservable, ShellToken} from "../../core/services/remote-shell.service";
import {Subscription} from "rxjs";
import {Buffer} from "buffer";

@Component({
  selector: 'app-terminal-dumb',
  templateUrl: './dumb.component.html',
  styleUrls: ['./dumb.component.scss']
})
export class DumbComponent implements OnInit, OnDestroy {

  @Input()
  public token?: ShellToken;

  @Input()
  public readonly?: boolean;

  public shell?: ShellObservable;

  public logs: CommandLog[] = [];

  @ViewChild('container')
  public container?: ElementRef<HTMLElement>;

  private subscription?: Subscription;

  constructor(private shells: RemoteShellService) {
  }

  ngOnInit(): void {
    this.shell = this.shells.obtain(this.token!);
    this.subscription = this.shell.subscribe((v) => {
      this.received(v);
    });
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
    const id = crypto.getRandomValues(Buffer.alloc(16)).toString('hex');
    this.logs.push({
      id: id,
      input: command,
      output: '',
    });
    this.shell?.write(`${command};echo command-${id}:$?\n`);
  }

  received(data: Buffer) {
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
      const container = this.container!.nativeElement;
      container.scrollTop = container.scrollHeight;
    }, 10);
  }
}

interface CommandLog {
  readonly id: string;
  readonly input: string;
  output: string;
  status?: number;
}
