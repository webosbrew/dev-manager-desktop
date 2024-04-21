import {AfterViewInit, Component, ElementRef, HostListener, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {debounceTime, filter, Observable, Subject, Subscription} from "rxjs";
import {LogLevel, LogMessage} from '../../core/services/remote-log.service';
import {Terminal} from "@xterm/xterm";
import {ITerminalDimensions} from "@xterm/addon-fit";
import chalk, {ChalkInstance} from 'chalk';
import {TERMINAL_CONFIG} from "../../shared/xterm/config";
import {AppWebLinksAddon} from "../../shared/xterm/web-links";
import {ISearchOptions, SearchAddon} from "@xterm/addon-search";

@Component({
    selector: 'app-log-reader',
    templateUrl: './log-reader.component.html',
    styleUrls: ['./log-reader.component.scss']
})
export class LogReaderComponent implements OnInit, OnDestroy, AfterViewInit {


    @ViewChild('termwin')
    public termwin!: ElementRef<HTMLElement>;

    public term: Terminal;
    public searchTextChange: Subject<string>;
    public matchesStatus?: { resultIndex: number, resultCount: number };
    public showSearchBar = false;

    private readonly searchAddon: SearchAddon;

    private sourceSubscription?: Subscription;
    private searchTextSubscription?: Subscription;
    private searchTerm?: string;
    private searchOptions: ISearchOptions;

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
            allowProposedApi: true,
            scrollback: LogReaderComponent.retainLogs,
            disableStdin: true,
            ...TERMINAL_CONFIG,
        });
        this.searchAddon = new SearchAddon();
        this.term.loadAddon(new AppWebLinksAddon());
        this.term.loadAddon(this.searchAddon);
        this.searchAddon.onDidChangeResults((e) => {
            this.matchesStatus = e;
        });
        this.searchTextChange = new Subject<string>();
        const computedStyle = getComputedStyle(document.documentElement);
        this.searchOptions = {
            decorations: {
                matchOverviewRuler: computedStyle.getPropertyValue('--bs-white'),
                matchBackground: computedStyle.getPropertyValue('--bs-yellow'),
                activeMatchColorOverviewRuler: computedStyle.getPropertyValue('--bs-white'),
                activeMatchBackground: computedStyle.getPropertyValue('--bs-orange')
            }
        }
    }

    ngOnInit() {
        this.searchTextSubscription = this.searchTextChange.pipe(filter(v => !!v), debounceTime(300))
            .subscribe((text) => {
                this.searchAddon.clearDecorations();
                this.searchTerm = text;
                this.searchAddon.findNext(text, this.searchOptions);
            });
    }

    ngOnDestroy(): void {
        this.searchTextSubscription?.unsubscribe();
        this.sourceSubscription?.unsubscribe();
    }

    ngAfterViewInit(): void {
        this.term.open(this.termwin.nativeElement);
    }

    @HostListener('window:beforeunload')
    beforeUnload(): void {
        this.searchTextSubscription?.unsubscribe();
        this.sourceSubscription?.unsubscribe();
    }

    @Input()
    set source(source: Observable<LogMessage> | undefined) {
        this.sourceSubscription?.unsubscribe();
        this.sourceSubscription = undefined;
        this.term.clear();
        if (source) {
            this.sourceSubscription = source.subscribe(message => this.writeLog(message));
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

    toggleSearchBar() {
        if (this.showSearchBar) {
            this.closeSearchBar();
        } else {
            this.showSearchBar = true;
        }
    }

    closeSearchBar() {
        this.showSearchBar = false;
        this.searchAddon.clearDecorations();
        this.searchTerm = undefined;
    }

    searchNext() {
        if (!this.searchTerm) {
            return;
        }
        this.searchAddon.findNext(this.searchTerm, this.searchOptions);
    }

    searchPrevious() {
        if (!this.searchTerm) {
            return;
        }
        this.searchAddon.findPrevious(this.searchTerm, this.searchOptions);
    }
}
