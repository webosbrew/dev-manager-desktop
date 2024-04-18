import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import {IDisposable, Terminal} from "@xterm/xterm";

import {FitAddon, ITerminalDimensions} from "@xterm/addon-fit";
import {debounceTime, defer, delay, firstValueFrom, fromEvent, noop, of, repeat, Subscription, tap} from "rxjs";
import {filter, map} from "rxjs/operators";
import {isNonNull} from "../../operators";
import {TERMINAL_CONFIG} from "../../xterm/config";

@Component({
  selector: 'app-terminal-size-calculator',
  templateUrl: './size-calculator.component.html',
  styleUrls: ['./size-calculator.component.scss'],
})
export class SizeCalculatorComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('termwin')
  public termwin!: ElementRef<HTMLElement>;

  @Input()
  size?: ITerminalDimensions;

  @Output()
  public sizeChange: EventEmitter<ITerminalDimensions | undefined> = new EventEmitter<ITerminalDimensions | undefined>();
  @Output()
  public pendingResizeChange: EventEmitter<ITerminalDimensions | undefined> = new EventEmitter();
  public term: Terminal;
  private readonly fitAddon: FitAddon;
  private resizeSubscription?: Subscription;
  private termResize!: IDisposable;

  constructor() {
    this.term = new Terminal({
      scrollback: 1000,
      disableStdin: true,
      ...TERMINAL_CONFIG,
    });
    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
  }

  ngOnInit(): void {
    this.resizeSubscription = fromEvent(window, 'resize')
      .pipe(
        map(() => this.fitAddon.proposeDimensions()),
        filter(isNonNull),
        tap((size) => this.pendingResizeChange.emit(size)),
        debounceTime(500)
      ).subscribe((size) => {
        this.pendingResizeChange.emit(undefined);
        this.term.resize(size.cols, size.rows);
      });
    this.termResize = this.term.onResize((size) => this.sizeChange.emit(size));
  }

  ngAfterViewInit(): void {
    this.term.open(this.termwin.nativeElement);
    firstValueFrom(defer(() => of(this.fitAddon.proposeDimensions())).pipe(
      delay(10),
      repeat({
        count: 10,
        delay: 30,
      }),
      filter((v: ITerminalDimensions | undefined): v is ITerminalDimensions => isNonNull(v)))
    ).then(v => {
      this.term.resize(v.cols, v.rows);
    }).catch(noop);
  }

  ngOnDestroy(): void {
    this.termResize.dispose();
    this.term.dispose();
    this.resizeSubscription?.unsubscribe();
    delete this.resizeSubscription;
  }

}
