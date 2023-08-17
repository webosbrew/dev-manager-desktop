import {Component, Host, Input, OnDestroy} from '@angular/core';
import {AppsComponent} from '../apps.component';
import {Device, PackageInfo} from "../../types";
import {Observable, Subscription} from "rxjs";
import {AppsRepoService, RepositoryItem} from "../../core/services";

@Component({
  selector: 'app-installed',
  templateUrl: './installed.component.html',
  styleUrls: ['./installed.component.scss']
})
export class InstalledComponent implements OnDestroy {

  @Input()
  device: Device | null = null;

  installedError?: Error;

  repoPackages?: Record<string, RepositoryItem>;

  private subscription?: Subscription;
  private installedField?: Observable<PackageInfo[] | null>;

  constructor(@Host() public parent: AppsComponent, private appsRepo: AppsRepoService) {
  }

  @Input()
  set installed$(value: Observable<PackageInfo[] | null> | undefined) {
    this.subscription?.unsubscribe();
    this.subscription = value?.subscribe({
      next: (pkgs) => {
        this.installedError = undefined;

        const strings: string[] = pkgs?.map((pkg) => pkg.id) ?? [];
        this.appsRepo.showApps(...strings).then(apps => this.repoPackages = apps);
      },
      error: (error) => this.installedError = error
    });
    this.installedField = value;
  }

  get installed$(): Observable<PackageInfo[] | null> | undefined {
    return this.installedField;
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  loadPackages(): void {
    this.installedError = undefined;
    this.parent.loadPackages();
  }
}
