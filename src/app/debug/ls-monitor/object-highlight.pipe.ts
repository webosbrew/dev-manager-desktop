import {Pipe, PipeTransform} from '@angular/core';

import hljs from 'highlight.js/lib/core';

@Pipe({name: 'objectHighlight'})
export class ObjectHighlightPipe implements PipeTransform {

    transform(value: unknown): string {
        return hljs.highlight(JSON.stringify(value, undefined, 2), {
            language: 'json',
            ignoreIllegals: true
        }).value;
    }

}
