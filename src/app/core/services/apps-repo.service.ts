import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {firstValueFrom, Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {eq as semverEq, gt as semverGt} from 'semver';
import {keyBy} from "lodash-es";

const baseUrl = 'https://repo.webosbrew.org/api';

@Injectable({
  providedIn: 'root'
})
export class AppsRepoService {

  constructor(private http: HttpClient) {
  }

  async showApp(id: string): Promise<RepositoryItem> {
    return firstValueFrom(this.http.get<Partial<RepositoryItem>>(`${baseUrl}/apps/${id}/releases/latest.json`)
      .pipe(map((body) => new RepositoryItem(body))));
  }

  async showApps(...ids: string[]): Promise<Record<string, RepositoryItem>> {
    function assertFulfilled(item: PromiseSettledResult<RepositoryItem>): item is PromiseFulfilledResult<RepositoryItem> {
      return item.status === 'fulfilled';
    }

    return await Promise.allSettled(ids.map(id => this.showApp(id)))
      .then(list => list.filter(assertFulfilled).map(result => result.value))
      .then((list: RepositoryItem[]) => keyBy(list, pkg => pkg.id));
  }

  allApps$(page = 0): Observable<RepositoryPage> {
    const suffix = page > 1 ? `apps/${page}.json` : 'apps.json';
    return this.http.get(`${baseUrl}/${suffix}`).pipe(map((body) => new RepositoryPage(body)));
  }
}

export class PackageManifest {
  id: string = '';
  version: string = '';
  ipkUrl: string = '';
  ipkHash?: { sha256: string; };
  sourceUrl?: string;
  appDescription: string = '';

  constructor(data: Partial<PackageManifest>) {
    Object.assign(this, data);
  }

  hasUpdate(version?: string): boolean | null {
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
    if ((suffix1 || suffix2) && semverEq(v1, v2, true)) {
      const snum1 = Number(suffix1), snum2 = Number(suffix2);
      if (!isNaN(snum1) && !isNaN(snum2)) {
        return snum1 > snum2;
      }
      return suffix1.localeCompare(suffix2) > 0;
    }
    return semverGt(v1, v2);
  }
}

export class RepositoryItem {
  id: string = '';
  title: string = '';
  iconUri: string = '';
  manifest?: PackageManifest;
  manifestUrl?: string;
  manifestBeta?: PackageManifest;

  constructor(data: Partial<RepositoryItem>) {
    Object.assign(this, data);
    if (data.manifest) {
      this.manifest = new PackageManifest(data.manifest);
    }
    if (data.manifestBeta) {
      this.manifestBeta = new PackageManifest(data.manifestBeta);
    }
  }
}

export interface Paging {
  page: number;
  count: number;
  maxPage: number;
  itemsTotal: number;
}

export class RepositoryPage {
  paging: Paging;
  packages: RepositoryItem[];

  constructor(data: Partial<RepositoryPage>) {
    this.paging = data.paging!;
    this.packages = data.packages?.map((item) => new RepositoryItem(item)) ?? [];
  }
}
