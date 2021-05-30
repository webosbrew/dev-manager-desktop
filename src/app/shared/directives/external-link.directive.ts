import { Directive, HostListener, Input } from '@angular/core';
import { ElectronService } from '../../core/services';

@Directive({
  selector: 'a[href]'
})
export class ExternalLinkDirective {
  @Input() href: string;
  constructor(private electron: ElectronService) {

  }

  @HostListener('click')
  onClick(): boolean {
    if (this.electron.isElectron && this.isLinkExternal()) {
      this.electron.remote.shell.openExternal(this.href);
      return false;
    } else {
      window.open(this.href, '_blank');
      return false;
    }
  }

  private isLinkExternal() {
    return !this.href.includes(location.hostname);
  }
}
