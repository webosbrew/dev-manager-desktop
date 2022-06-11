import {Component, OnDestroy, OnInit} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {TranslateService} from '@ngx-translate/core';
import {Observable, Subscription} from 'rxjs';
import {Device, PackageInfo} from '../../../../common/types';
import {AppManagerService, AppsRepoService, DeviceManagerService, RepositoryItem} from '../core/services';
import {MessageDialogComponent} from '../shared/components/message-dialog/message-dialog.component';
import {ProgressDialogComponent} from '../shared/components/progress-dialog/progress-dialog.component';
import {dialog, getCurrentWindow} from "@electron/remote";

@Component({
  selector: 'app-apps',
  templateUrl: './apps.component.html',
  styleUrls: ['./apps.component.scss']
})
export class AppsComponent implements OnInit, OnDestroy {

  packages$?: Observable<PackageInfo[]>;
  instPackages?: Map<string, PackageInfo>;
  repoPackages?: Map<string, RepositoryItem>;
  device: Device | null = null;
  packagesError: Error | null = null;

  private deviceSubscription?: Subscription;
  private packagesSubscription?: Subscription;

  constructor(
    private modalService: NgbModal,
    private translate: TranslateService,
    private deviceManager: DeviceManagerService,
    private appManager: AppManagerService,
    private appsRepo: AppsRepoService,
  ) {
  }

  ngOnInit(): void {
    this.deviceSubscription = this.deviceManager.selected$.subscribe((device) => {
      this.device = device;
      if (device) {
        this.loadPackages();
      } else {
        this.packages$ = undefined;
        this.packagesError = null;
        this.packagesSubscription?.unsubscribe();
        this.packagesSubscription = undefined;
      }
    });
  }

  ngOnDestroy(): void {
    this.deviceSubscription?.unsubscribe();
    this.packagesSubscription?.unsubscribe();
    this.packagesSubscription = undefined;
  }

  onDragOver(event: DragEvent): void {
    // console.log('onDragOver', event.type, event.dataTransfer.items.length && event.dataTransfer.items[0]);
    event.preventDefault();
  }

  onDragEnter(event: DragEvent): void {
    const transfer = event.dataTransfer!;
    if (transfer.items.length != 1 || transfer.items[0].kind != 'file') {
      return;
    }
    event.preventDefault();
    console.log('onDragEnter', event.type, transfer.items.length && transfer.items[0]);
  }

  onDragLeave(event: DragEvent): void {
    const dataTransfer = event.dataTransfer!;
    console.log('onDragLeave', dataTransfer.items.length && dataTransfer.items[0]);
  }

  loadPackages(): void {
    const device = this.device;
    if (!device) return;
    this.packages$ = this.appManager.packages$(device.name);
    this.packagesSubscription?.unsubscribe();
    this.packagesSubscription = this.packages$.subscribe({
      next: (pkgs) => {
        this.packagesError = null;
        if (pkgs.length) {
          this.instPackages = new Map(pkgs.map((pkg) => [pkg.id, pkg]));
          const strings: string[] = pkgs.map((pkg) => pkg.id);
          this.appsRepo.showApps(...strings).then(apps => this.repoPackages = apps);
        }
      }, error: (error) => this.packagesError = error
    });
    this.appManager.load(device.name);
  }

  async dropFiles(event: DragEvent): Promise<void> {
    if (!this.device) return;
    const transfer = event.dataTransfer!;
    console.log('dropFiles', event, transfer.files);
    const files = transfer.files;
    if (files.length != 1 || !files[0].name.endsWith('.ipk')) {
      // Show error
      return;
    }
    const file: File = files[0];
    const progress = ProgressDialogComponent.open(this.modalService);
    await this.appManager.install(this.device.name, file.webkitRelativePath);
    progress.close(true);
  }

  async openInstallChooser(): Promise<void> {
    if (!this.device) return;
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
    if (!this.device) return;
    this.appManager.launch(this.device.name, id);
  }

  async removePackage(pkg: PackageInfo): Promise<void> {
    if (!this.device) return;
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
    if (!this.device) return;
    const progress = ProgressDialogComponent.open(this.modalService);
    try {
      await this.appManager.installUrl(this.device.name, item.manifest!.ipkUrl);
    } catch (e) {
      // Ignore
    }
    progress.close(true);
  }

  async installBetaPackage(item: RepositoryItem): Promise<void> {
    if (!this.device) return;
    const progress = ProgressDialogComponent.open(this.modalService);
    try {
      await this.appManager.installUrl(this.device.name, item.manifestBeta!.ipkUrl);
    } catch (e) {
      // Ignore
    }
    progress.close(true);
  }
}
