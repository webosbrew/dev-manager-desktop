import {Component, OnInit} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {TranslateService} from '@ngx-translate/core';
import {Observable, Subscription} from 'rxjs';
import {Device} from '../../../types/novacom';
import {
  AppManagerService,
  AppsRepoService,
  DeviceManagerService,
  ElectronService,
  PackageInfo,
  RepositoryItem
} from '../../core/services';
import {MessageDialogComponent} from '../../shared/components/message-dialog/message-dialog.component';
import {ProgressDialogComponent} from '../../shared/components/progress-dialog/progress-dialog.component';
import {dialog, getCurrentWindow} from "@electron/remote";

@Component({
  selector: 'app-apps',
  templateUrl: './apps.component.html',
  styleUrls: ['./apps.component.scss']
})
export class AppsComponent implements OnInit {

  packages$: Observable<PackageInfo[]>;
  instPackages: Map<string, PackageInfo>;
  repoPackages: Map<string, RepositoryItem>;
  device: Device;
  packagesError: any;

  private subscription: Subscription;

  constructor(
    private electron: ElectronService,
    private modalService: NgbModal,
    private translate: TranslateService,
    private deviceManager: DeviceManagerService,
    private appManager: AppManagerService,
    private appsRepo: AppsRepoService,
  ) {
    deviceManager.selected$.subscribe((device) => {
      this.device = device;
      if (device) {
        this.loadPackages();
      } else {
        this.packages$ = null;
        this.packagesError = null;
        if (this.subscription) {
          this.subscription.unsubscribe();
        }
      }
    });
  }

  ngOnInit(): void {
  }

  onDragOver(event: DragEvent): void {
    // console.log('onDragOver', event.type, event.dataTransfer.items.length && event.dataTransfer.items[0]);
    event.preventDefault();
  }

  onDragEnter(event: DragEvent): void {
    if (event.dataTransfer.items.length != 1 || event.dataTransfer.items[0].kind != 'file') {
      return;
    }
    event.preventDefault();
    console.log('onDragEnter', event.type, event.dataTransfer.items.length && event.dataTransfer.items[0]);
  }

  onDragLeave(event: DragEvent): void {
    console.log('onDragLeave', event.dataTransfer.items.length && event.dataTransfer.items[0]);
  }

  loadPackages(): void {
    const device = this.device;
    this.packages$ = this.appManager.packages$(device.name);
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.subscription = this.packages$.subscribe({
      next: async (pkgs) => {
        this.packagesError = null;
        if (pkgs.length) {
          this.instPackages = new Map(pkgs.map((pkg) => [pkg.id, pkg]));
          this.repoPackages = await this.appsRepo.showApps(...pkgs.map((pkg) => pkg.id));
        }
      }, error: (error) => this.packagesError = error
    });
    this.appManager.load(device.name);
  }

  async dropFiles(event: DragEvent): Promise<void> {
    console.log('dropFiles', event, event.dataTransfer.files);
    const files = event.dataTransfer.files;
    if (files.length != 1 || !files[0].name.endsWith('.ipk')) {
      // Show error
      return;
    }
    const file = files[0];
    const progress = ProgressDialogComponent.open(this.modalService);
    await this.appManager.install(this.device.name, file.path);
    progress.close(true);
  }

  async openInstallChooser(): Promise<void> {
    const open = await dialog.showOpenDialog(getCurrentWindow(), {
      filters: [{name: 'IPK package', extensions: ['ipk']}]
    });
    if (open.canceled) {
      return;
    }
    const path = open.filePaths[0];
    const progress = ProgressDialogComponent.open(this.modalService);
    await this.appManager.install(this.device.name, path);
    progress.close(true);
  }

  launchApp(id: string): void {
    this.appManager.launch(this.device.name, id);
  }

  async removePackage(pkg: PackageInfo): Promise<void> {
    const confirm = MessageDialogComponent.open(this.modalService, {
      title: this.translate.instant('MESSAGES.TITLE_REMOVE_APP'),
      message: this.translate.instant('MESSAGES.CONFIRM_REMOVE_APP', {name: pkg.title}),
      positive: this.translate.instant('ACTIONS.REMOVE'),
      positiveStyle: 'danger',
      negative: this.translate.instant('ACTIONS.CANCEL')
    });
    if (!await confirm.result) return;
    const progress = ProgressDialogComponent.open(this.modalService);
    try {
      await this.appManager.remove(this.device.name, pkg.id);
    } catch (e) {
      // Ignore
    }
    progress.close(true);
  }

  async installPackage(item: RepositoryItem): Promise<void> {
    const progress = ProgressDialogComponent.open(this.modalService);
    try {
      await this.appManager.installUrl(this.device.name, item.manifest.ipkUrl);
    } catch (e) {
      // Ignore
    }
    progress.close(true);
  }

  async installBetaPackage(item: RepositoryItem): Promise<void> {
    const progress = ProgressDialogComponent.open(this.modalService);
    try {
      await this.appManager.installUrl(this.device.name, item.manifestBeta.ipkUrl);
    } catch (e) {
      // Ignore
    }
    progress.close(true);
  }
}
