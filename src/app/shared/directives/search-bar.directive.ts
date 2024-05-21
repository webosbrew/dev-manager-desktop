import {Directive, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {parse as parseQuery, SearchParserResult} from 'search-query-parser';
import {debounceTime, Subject, Subscription} from "rxjs";

@Directive({
    selector: 'input[appSearchBar]',
})
export class SearchBarDirective implements OnInit, OnDestroy {

    @Output()
    query: EventEmitter<TokenizedSearchParserResult> = new EventEmitter();

    private keywordsField: string[] = [];
    private rangesField: string[] = [];
    private emitChanges: Subject<void> = new Subject();
    private changesSubscription!: Subscription;

    constructor(private hostRef: ElementRef<HTMLInputElement>) {
    }


    @Input()
    set keywords(value: string | undefined) {
        this.keywordsField = value?.split(',') || [];
        this.emitChanges.next();
    }

    @Input()
    set ranges(value: string | undefined) {
        this.rangesField = value?.split(',') || [];
        this.emitChanges.next();
    }

    ngOnInit(): void {
        this.changesSubscription = this.emitChanges.pipe(debounceTime(50)).subscribe(() => this.emitChange());
        this.emitChanges.next();
    }

    ngOnDestroy() {
        this.changesSubscription.unsubscribe();
        this.emitChanges.complete();
    }

    @HostListener('change')
    inputChanged(): void {
        this.emitChanges.next();
    }

    private emitChange(): void {
        this.query.emit(parseQuery(this.hostRef.nativeElement?.value || '', {
            keywords: this.keywordsField,
            ranges: this.rangesField,
            alwaysArray: true,
            tokenize: true,
        }));
    }

}


export type TokenizedSearchParserResult = SearchParserResult & { text?: string[] };
