import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input, NgZone,
  OnDestroy,
  OnInit,
  Output,
  ViewChild, ViewEncapsulation
} from '@angular/core';
import {IDisposable, Terminal} from "xterm";

import {FitAddon, ITerminalDimensions} from "xterm-addon-fit";
import {debounceTime, fromEvent, noop, Subscription, tap} from "rxjs";
import {filter, map} from "rxjs/operators";
import {isNonNull} from "../../shared/operators";

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

  constructor(private zone: NgZone) {
    this.term = new Terminal({
      scrollback: 1000,
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
    setTimeout(() => {
      const dimensions = this.fitAddon.proposeDimensions();
      if (dimensions) {
        this.term.resize(dimensions.cols, dimensions.rows);
      }
    }, 30);
  }

  ngOnDestroy(): void {
    this.termResize.dispose();
    this.resizeSubscription?.unsubscribe();
    delete this.resizeSubscription;
  }

}
