import {SearchBarDirective} from './search-bar.directive';
import {Component} from "@angular/core";
import {TestBed} from "@angular/core/testing";

describe('SearchBarDirective', () => {

    it('should create an instance', () => {
        let component = TestBed.createComponent(TestSearchBarDirectiveHostComponent);
    });
});

@Component({
    selector: 'app-test-search-bar-directive-host',
    template: `<input type="search" class="form-control form-control-sm"
                      appSearchBar keywords="sender,destination">`
})
class TestSearchBarDirectiveHostComponent {
}
