import {Pipe, PipeTransform} from "@angular/core";
import {DomSanitizer} from '@angular/platform-browser';

@Pipe({
  name: 'trustUri'
})
export class TrustUriPipe implements PipeTransform {

  constructor(private sanitizer: DomSanitizer) {
  }

  transform(uri?: string) {
    return uri && this.sanitizer.bypassSecurityTrustUrl(uri);
  }

}
