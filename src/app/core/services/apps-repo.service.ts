import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as semver from 'semver';
import { AllowCORSHandler } from '../../shared/util/cors-skip';
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
    session.defaultSession.webRequest.onHeadersReceived(filter, AllowCORSHandler);
  }

  async showApp(id: string): Promise<RepositoryItem> {
    return this.http.get(`${baseUrl}/apps/${id}.json`).pipe(map((body) => new RepositoryItem(body))).toPromise();
  }

  async showApps(...ids: string[]): Promise<Map<string, RepositoryItem>> {
    return new Map(await Promise.all(ids.map((id) => this.showApp(id).then(pkg => [pkg.id, pkg]).catch(() => null)))
      .then(list => list.filter(v => v != null)));
  }

  allApps$(page = 0): Observable<RepositoryPage> {
    const suffix = page > 1 ? `apps/${page}.json` : 'apps.json';
    return this.http.get(`${baseUrl}/${suffix}`).pipe(map((body) => new RepositoryPage(body)));
  }
}

export class PackageManifest {
  id: string;
  version: string;
  ipkUrl: string;

  constructor(data: Partial<PackageManifest>) {
    Object.assign(this, data);
  }

  hasUpdate(version: string): boolean | null {
    if (!version) return null;
    let v1 = this.version, v2 = version;
    const segs1 = this.version.split('.', 4), segs2 = version.split('.', 4);
    let suffix1 = '', suffix2 = '';
    if (segs1.length > 3) {
      v1 = segs1.slice(0, 3).join('.');
      suffix1 = segs1[3];
    }
    if (segs2.length > 3) {
      v2 = segs2.slice(0, 3).join('.');
      suffix2 = segs2[3];
    }
    if ((suffix1 || suffix2) && semver.eq(v1, v2, true)) {
      const snum1 = Number(suffix1), snum2 = Number(suffix2);
      if (!isNaN(snum1) && !isNaN(snum2)) {
        return snum1 > snum2;
      }
      return suffix1.localeCompare(suffix2) > 0;
    }
    return semver.gt(v1, v2);
  }
}

export class RepositoryItem {
  id: string;
  title: string;
  manifest?: PackageManifest;
  manifestUrl?: string;

  constructor(data: Partial<RepositoryItem>) {
    Object.assign(this, data);
    if (data.manifest) {
      this.manifest = new PackageManifest(data.manifest);
    }
  }
}

export class RepositoryPage {
  paging: {
    page: number;
    count: number;
    maxPage: number;
    itemsTotal: number;
  };
  packages: RepositoryItem[];

  constructor(data: Partial<RepositoryPage>) {
    this.paging = data.paging;
    this.packages = data.packages?.map((item) => new RepositoryItem(item));
  }
}
