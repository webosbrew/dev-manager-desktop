import {Component, Host, Input, OnChanges, OnDestroy, SimpleChanges} from '@angular/core';
import {AppsComponent} from '../apps.component';
import {Device, PackageInfo} from "../../types";
import {Observable, Subscription} from "rxjs";
import {AppsRepoService, RepositoryItem} from "../../core/services";

@Component({
  selector: 'app-installed',
  templateUrl: './installed.component.html',
  styleUrls: ['./installed.component.scss']
})
export class InstalledComponent implements OnDestroy, OnChanges {

  @Input()
  device: Device | null = null;

  @Input()
  installed$?: Observable<PackageInfo[] | null>;

  installedError?: Error;

  repoPackages?: Record<string, RepositoryItem>;

  private subscription?: Subscription;

  constructor(@Host() public parent: AppsComponent, private appsRepo: AppsRepoService) {
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['installed$']) {
      this.subscription?.unsubscribe();
      this.subscription = this.installed$?.subscribe((pkgs) => {
          this.installedError = undefined;

          const strings: string[] = pkgs?.map((pkg) => pkg.id) ?? [];
          this.appsRepo.showApps(...strings).then(apps => this.repoPackages = apps);
        },
        (error) => this.installedError = error);
    }
  }

  loadPackages(): void {
    this.installedError = undefined;
    this.parent.loadPackages();
  }
}
