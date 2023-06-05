import {AfterViewInit, Component, ElementRef, HostListener, Input, OnDestroy, ViewChild} from '@angular/core';
import {Observable, Subscription} from "rxjs";
import {LogLevel, LogMessage} from '../../core/services/remote-log.service';
import {Terminal} from "xterm";
import {ITerminalDimensions} from "xterm-addon-fit";
import chalk, {ChalkInstance} from 'chalk';
import {TERMINAL_CONFIG} from "../../shared/xterm/config";
import {AppWebLinksAddon} from "../../shared/xterm/web-links";

@Component({
  selector: 'app-log-reader',
  templateUrl: './log-reader.component.html',
  styleUrls: ['./log-reader.component.scss']
})
export class LogReaderComponent implements OnDestroy, AfterViewInit {


  @ViewChild('termwin')
  public termwin!: ElementRef<HTMLElement>;

  public term: Terminal;
  private sourceField?: Observable<LogMessage>;
  private subscription?: Subscription;
  private messageStyles: Record<LogLevel, ChalkInstance> = {
    emerg: chalk.bgRed.blackBright.bold,
    alert: chalk.bgRed.yellowBright.bold,
    crit: chalk.bgRed.whiteBright.bold,
    err: chalk.red,
    warning: chalk.yellow,
    notice: chalk.white.bold,
    info: chalk.white,
    debug: chalk.gray,
  };
  static readonly retainLogs = 10000;


  constructor() {
    this.term = new Terminal({
      scrollback: LogReaderComponent.retainLogs,
      disableStdin: true,
      ...TERMINAL_CONFIG,
    });
    this.term.loadAddon(new AppWebLinksAddon());
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  ngAfterViewInit(): void {
    this.term.open(this.termwin.nativeElement);
  }

  @HostListener('window:beforeunload')
  beforeUnload(): void {
    this.subscription?.unsubscribe();
  }

  @Input()
  set source(source: Observable<LogMessage> | undefined) {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    this.term.clear();
    this.sourceField = source;
    if (source) {
      this.subscription = source.subscribe(message => this.writeLog(message));
    }
  }

  @Input()
  set termSize(dimension: ITerminalDimensions | undefined) {
    if (!dimension) {
      return;
    }
    this.term.resize(dimension.cols, dimension.rows);
  }

  get termSize(): ITerminalDimensions | undefined {
    return {cols: this.term.cols, rows: this.term.rows};
  }

  private writeLog(message: LogMessage): void {
    const levelStyle = this.messageStyles[message.level] ?? chalk.white;
    this.term.write(chalk.green(`[${message.datetime.toISOTime({includeOffset: false})}]`));
    this.term.write(levelStyle(`[${message.level.toUpperCase()}]`));
    if (message.context) {
      this.term.write(` ${chalk.yellow(message.context)}`);
    }
    if (message.msgid) {
      this.term.write(` ${chalk.yellow(message.msgid)}`);
    }
    this.term.write(' ' + levelStyle(message.message));
    if (message.extras) {
      this.term.write(' ' + chalk.dim(JSON.stringify(message.extras)));
    }
    this.term.writeln('');
  }

  get reachedBottom(): boolean {
    return this.term.buffer.active.viewportY >= this.term.buffer.active.baseY;
  }

  scrollToBottom() {
    this.term.scrollToBottom();
  }
}
