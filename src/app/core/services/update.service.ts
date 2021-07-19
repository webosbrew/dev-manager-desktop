import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { SemVer } from 'semver';
@Injectable({
  providedIn: 'root'
})
export class UpdateService {

  constructor(private http: HttpClient) { }

  async getRecentRelease(): Promise<Release> {
    return this.http.get<Partial<Release>>('https://api.github.com/repos/webosbrew/dev-manager-desktop/releases/latest', {
      headers: { 'accept': 'application/vnd.github.v3+json' },
      responseType: 'json'
    }).pipe(map(d => new ReleaseImpl(d))).toPromise();
  }

  get ignoreUntil(): SemVer | null {
    try {
      return new SemVer(localStorage.getItem('devManager:ignoreVersionUntil'), true);
    } catch (e) { return null; }
  }

  set ignoreUntil(value: SemVer | null) {
    localStorage.setItem('devManager:ignoreVersionUntil', value?.version);
  }
}

export interface Release {
  readonly html_url: string;
  readonly tag_name: string;
  readonly body: string;
}

class ReleaseImpl implements Release {
  html_url: string;
  tag_name: string;
  body: string;

  constructor(data: Partial<ReleaseImpl>) {
    Object.assign(this, data);
  }

}
