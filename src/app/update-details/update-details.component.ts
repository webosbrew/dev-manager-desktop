import {Component, Inject, SecurityContext, ViewEncapsulation} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import * as marked from 'marked';
import {Release} from '../core/services';

@Component({
    selector: 'app-update-details',
    templateUrl: './update-details.component.html',
    styleUrls: ['./update-details.component.scss'],
    encapsulation: ViewEncapsulation.None,
})
export class UpdateDetailsComponent {

    public bodyHtml: string;

    constructor(@Inject('release') public release: Release, sanitizer: DomSanitizer) {
        this.bodyHtml = sanitizer.sanitize(SecurityContext.HTML, marked.marked(release.body)) || 'No description.';
    }
}
