import {SshAuthValueDirective} from './ssh-auth-value.directive';
import {Component} from "@angular/core";
import {NewDeviceAuthentication} from "../../types";
import {TestBed} from "@angular/core/testing";

describe('SshAuthValueDirective', () => {
    it('should create an instance', () => {
        const component = TestBed.createComponent(TestSshAuthValueDirectiveHostComponent);
    });
});

@Component({
    selector: 'app-test-ssh-auth-value-directive-host',
    template: `<input type="text" class="form-control" id="authValue" formControlName="value"
                      [appSshAuthValue]="NewDeviceAuthentication.AppKey"
                      autocomplete="off">`
})
class TestSshAuthValueDirectiveHostComponent {
    protected readonly NewDeviceAuthentication = NewDeviceAuthentication;
}
