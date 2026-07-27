import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';

import {SearchBarDirective, TokenizedSearchParserResult} from './search-bar.directive';

@Component({
    selector: 'app-test-search-bar-host',
    imports: [SearchBarDirective],
    template: `<input type="search" appSearchBar keywords="sender,destination"
                      (query)="lastQuery = $event">`,
})
class HostComponent {
    lastQuery?: TokenizedSearchParserResult;
}

describe('SearchBarDirective', () => {
    it('splits a query into its declared keywords', async () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();

        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        input.value = 'sender:com.webos.app hello';
        // The directive listens for `change`, not `input`, and debounces by 50ms.
        input.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 150));
        fixture.detectChanges();

        expect(fixture.componentInstance.lastQuery?.['sender']).toEqual(['com.webos.app']);
        expect(fixture.componentInstance.lastQuery?.['text']).toEqual(['hello']);
    });
});
