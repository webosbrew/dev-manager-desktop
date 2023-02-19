import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  ViewChild
} from '@angular/core';
import {Observable, Subscription} from "rxjs";
import {PmLogLevel, PmLogMessage} from '../../../core/services/remote-log.service';
import {Terminal} from "xterm";
import {ITerminalDimensions} from "xterm-addon-fit";
import chalk, {ChalkInstance} from 'chalk';
import {TERMINAL_CONFIG} from "../../../terminal/terminal.module";

@Component({
  selector: 'app-log-messages-reader',
  templateUrl: './pmlog-reader.component.html',
  styleUrls: ['./pmlog-reader.component.scss']
})
export class PmLogReaderComponent implements OnDestroy, AfterViewInit {


  @ViewChild('termwin')
  public termwin!: ElementRef<HTMLElement>;

  public term: Terminal;
  private sourceField?: Observable<PmLogMessage>;
  private subscription?: Subscription;
  private messageStyles: Record<PmLogLevel, ChalkInstance> = {
    emerg: chalk.bgRed.blackBright.bold,
    alert: chalk.bgRed.yellowBright.bold,
    crit: chalk.bgRed.whiteBright.bold,
    err: chalk.red,
    warning: chalk.yellow,
    notice: chalk.white.bold,
    info: chalk.white,
    debug: chalk.gray,
  };
  static readonly retainLogs = 1000;


  constructor() {
    this.term = new Terminal({
      scrollback: PmLogReaderComponent.retainLogs,
      disableStdin: true,
      ...TERMINAL_CONFIG,
    });
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
  set source(source: Observable<PmLogMessage> | undefined) {
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

  private writeLog(message: PmLogMessage): void {
    const line = `[${message.datetime.toISOTime({includeOffset: false})}][${message.level.toUpperCase()}]${message.message}`;
    this.term.writeln((this.messageStyles[message.level] ?? chalk.white)(line));
  }


}
