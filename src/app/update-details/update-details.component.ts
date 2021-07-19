import { Component, Inject, OnInit, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import marked from 'marked';
import { Release } from '../core/services';
@Component({
  selector: 'app-update-details',
  templateUrl: './update-details.component.html',
  styleUrls: ['./update-details.component.scss']
})
export class UpdateDetailsComponent implements OnInit {

  public bodyHtml: string;

  constructor(@Inject('release') public release: Release, sanitizer: DomSanitizer) {
    this.bodyHtml = sanitizer.sanitize(SecurityContext.HTML, marked(release.body || 'No description.'));
  }

  ngOnInit(): void {
  }

}
