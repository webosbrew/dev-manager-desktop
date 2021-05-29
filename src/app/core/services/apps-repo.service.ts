import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { ElectronService } from './electron.service';

const baseUrl = 'https://repo.webosbrew.org/api';

@Injectable({
  providedIn: 'root'
})
export class AppsRepoService {

  constructor(
    electron: ElectronService,
    private http: HttpClient
  ) {
    const session = electron.remote.session;
    const filter = {
      urls: ['https://repo.webosbrew.org/*']
    };
    session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
      callback({
        cancel: false,
        responseHeaders: {
          ...details.responseHeaders,
          'Access-Control-Allow-Origin': ['*']
        }
      });
    });
  }

  async showApp(id: string): Promise<RepositoryItem> {
    return this.http.get(`${baseUrl}/apps/${id}.json`).pipe(map((body) => body as RepositoryItem)).toPromise();
  }
}

export interface PackageManifest {
  id: string;
  version: string;
  ipkUrl: string;
}

export interface RepositoryItem {
  id: string;
  title: string;
  manifest?: PackageManifest;
  manifestUrl?: string;
}
