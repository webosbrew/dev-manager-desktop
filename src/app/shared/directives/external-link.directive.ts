import {Directive, HostListener} from '@angular/core';
import {open} from "@tauri-apps/plugin-shell";
import {noop} from "rxjs";

@Directive({
    selector: '[appExternalLink]'
})
export class ExternalLinkDirective {

    @HostListener('click', ['$event'])
    onClick(e: Event): boolean {
        const href = (e.target as HTMLAnchorElement)?.href;
        if (!href) {
            return false;
        }
        if (open && this.isLinkExternal(href)) {
            open(href).then(noop);
            return false;
        } else {
            window.open(href, '_blank');
            return false;
        }
    }

    private isLinkExternal(link: string) {
        const url = new URL(link);
        if (location.protocol == 'file:' && url.protocol != location.protocol) return true;
        return !url.hostname.endsWith(location.hostname);
    }
}
