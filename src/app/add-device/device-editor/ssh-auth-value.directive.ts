import {Directive, DoCheck, ElementRef, HostBinding, Input} from '@angular/core';
import {NgControl} from "@angular/forms";
import {NewDeviceAuthentication} from "../../types";

@Directive({
  selector: 'input[appSshAuthValue]',
})
export class SshAuthValueDirective implements DoCheck {

  @Input()
  appSshAuthValue?: NewDeviceAuthentication;

  constructor(private el: ElementRef<HTMLInputElement>, private ngControl: NgControl) {
  }

  @HostBinding('readonly')
  get inputReadOnly(): boolean {
    return this.appSshAuthValue === NewDeviceAuthentication.LocalKey;
  }

  @HostBinding('placeholder')
  get inputPlaceholder(): string {
    switch (this.appSshAuthValue) {
      case NewDeviceAuthentication.LocalKey:
        return 'SSH private key';
      case NewDeviceAuthentication.DevKey:
        return 'Dev Mode passphrase (CASE SENSITIVE)';
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

  ngDoCheck(): void {
    if (this.appSshAuthValue == NewDeviceAuthentication.LocalKey) {
      const keyPath = this.ngControl.value?.path;
      if (keyPath) {
        this.el.nativeElement.value = keyPath.substring(keyPath.lastIndexOf('/') + 1);
      } else {

      }
    }
  }

}
