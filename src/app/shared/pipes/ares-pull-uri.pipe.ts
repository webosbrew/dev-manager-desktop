import { Pipe, PipeTransform, Sanitizer } from "@angular/core";
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
  name: 'aresPullUri'
})
export class AresPullUriPipe implements PipeTransform {

  constructor(private sanitizer: DomSanitizer) { }

  transform(path: string, device: string) {
    return this.sanitizer.bypassSecurityTrustUrl(`ares-pull://${device}/${path}`);
  }

}
