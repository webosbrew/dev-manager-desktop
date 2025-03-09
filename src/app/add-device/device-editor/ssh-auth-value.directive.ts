import {Directive, ElementRef, HostBinding, Input, Renderer2} from '@angular/core';
import {NgControl} from "@angular/forms";
import {NewDeviceAuthentication} from "../../types";

@Directive({
    selector: 'input[appSshAuthValue]',
    standalone: true,
})
export class SshAuthValueDirective {

    private appSshAuthValueField?: NewDeviceAuthentication;

    constructor(private el: ElementRef<HTMLInputElement>, private renderer: Renderer2, private ngControl: NgControl) {
    }

    @HostBinding('readonly')
    get inputReadOnly(): boolean {
        return this.appSshAuthValue === NewDeviceAuthentication.LocalKey || this.appSshAuthValue === NewDeviceAuthentication.AppKey;
    }

    @HostBinding('placeholder')
    get inputPlaceholder(): string {
        switch (this.appSshAuthValue) {
            case NewDeviceAuthentication.LocalKey:
                return 'SSH private key';
            case NewDeviceAuthentication.DevKey:
                return 'Dev Mode passphrase (CASE SENSITIVE)';
            case NewDeviceAuthentication.AppKey:
                return 'SSH key from app';
            case NewDeviceAuthentication.Password:
                return 'SSH Password';
            default:
                return '';
        }
    }

    @HostBinding('type')
    get inputType(): string {
        switch (this.appSshAuthValue) {
            case NewDeviceAuthentication.Password:
                return 'password';
            default:
                return 'text';
        }
    }

    @HostBinding('required')
    get inputRequired(): boolean {
        return this.appSshAuthValue !== NewDeviceAuthentication.AppKey;
    }

    get appSshAuthValue(): NewDeviceAuthentication | undefined {
        return this.appSshAuthValueField;
    }

    @Input()
    set appSshAuthValue(value: NewDeviceAuthentication | undefined) {
        this.appSshAuthValueField = value;
        if (this.appSshAuthValue == NewDeviceAuthentication.LocalKey) {
            const keyPath = this.ngControl.value?.path;
            if (keyPath) {
                this.renderer.setProperty(this.el.nativeElement, 'value', keyPath.substring(keyPath.lastIndexOf('/') + 1));
            }
        } else if (value === NewDeviceAuthentication.AppKey) {
            this.renderer.setProperty(this.el.nativeElement, 'value', '');
        }
    }

}
