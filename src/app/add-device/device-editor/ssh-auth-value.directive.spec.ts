import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {FormControl, ReactiveFormsModule} from '@angular/forms';

import {SshAuthValueDirective} from './ssh-auth-value.directive';
import {NewDeviceAuthentication} from '../../types';

/**
 * The directive injects NgControl and binds `readonly`, so the host needs a real
 * form control — against a bare `<input>` it never instantiates.
 */
@Component({
    selector: 'app-test-ssh-auth-value-host',
    imports: [ReactiveFormsModule, SshAuthValueDirective],
    template: `<input type="text" [formControl]="control" [appSshAuthValue]="auth">`,
})
class HostComponent {
    control = new FormControl('');
    auth: NewDeviceAuthentication = NewDeviceAuthentication.AppKey;
}

describe('SshAuthValueDirective', () => {
    function render(auth: NewDeviceAuthentication): HTMLInputElement {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.componentInstance.auth = auth;
        fixture.detectChanges();
        return fixture.nativeElement.querySelector('input');
    }

    it('locks the value for key-based authentication', () => {
        expect(render(NewDeviceAuthentication.AppKey).readOnly).toBe(true);
        expect(render(NewDeviceAuthentication.LocalKey).readOnly).toBe(true);
    });

    it('leaves the value editable for password authentication', () => {
        expect(render(NewDeviceAuthentication.Password).readOnly).toBe(false);
    });
});
