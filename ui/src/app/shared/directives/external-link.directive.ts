import {Directive, HostListener, Input} from '@angular/core';
import {shell} from "@electron/remote";

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'a[href]'
})
export class ExternalLinkDirective {
  @Input()
  href: string = 'about:blank';

  constructor() {

  }

  @HostListener('click')
  onClick(): boolean {
    if (!this.href) return false;
    if (shell && this.isLinkExternal()) {
      shell.openExternal(this.href);
      return false;
    } else {
      window.open(this.href, '_blank');
      return false;
    }
  }

  private isLinkExternal() {
    const url = new URL(this.href);
    if (location.protocol == 'file:' && url.protocol != location.protocol) return true;
    return !url.hostname.endsWith(location.hostname);
  }
}
