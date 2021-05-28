import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { Device } from '../../../types/novacom';
import { AppManagerService, DeviceManagerService, ElectronService, PackageInfo } from '../../core/services';
import { MessageDialogComponent } from '../../shared/components/message-dialog/message-dialog.component';
import { ProgressDialogComponent } from '../../shared/components/progress-dialog/progress-dialog.component';
@Component({
  selector: 'app-apps',
  templateUrl: './apps.component.html',
  styleUrls: ['./apps.component.scss']
})
export class AppsComponent implements OnInit {

  dialog: Electron.Dialog;
  packages$: Observable<PackageInfo[]>;
  device: Device;
  constructor(
    private electron: ElectronService,
    private modalService: NgbModal,
    private translate: TranslateService,
    private deviceManager: DeviceManagerService,
    private appManager: AppManagerService
  ) {
    this.dialog = electron.remote.dialog;
    deviceManager.devices$.subscribe((devices) => {
      const device = devices.find((dev) => dev.default);
      if (device) {
        this.packages$ = this.appManager.packages$(device.name);
        this.packages$.subscribe(() => { }, (error) => {
          MessageDialogComponent.open(modalService, {
            title: translate.instant('MESSAGES.TITLE_CONNECTION_ERROR'),
            message: translate.instant('MESSAGES.ERROR_CONNECTION_ERROR', { name: device.name, message: error.message }),
            positive: this.translate.instant('ACTIONS.OK'),
            negative: this.translate.instant('ACTIONS.CANCEL')
          });
        });
        this.appManager.load(device.name);
      } else {
        this.packages$ = null;
      }
      this.device = device;
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
    const open = await this.dialog.showOpenDialog(this.electron.remote.getCurrentWindow(), {
      filters: [{ name: 'IPK package', extensions: ['ipk'] }]
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
      message: this.translate.instant('MESSAGES.CONFIRM_REMOVE_APP', { name: pkg.title }),
      positive: this.translate.instant('ACTIONS.REMOVE'),
      positiveStyle: 'danger',
      negative: this.translate.instant('ACTIONS.CANCEL')
    });
    if (!await confirm.result) return;
    const progress = ProgressDialogComponent.open(this.modalService);
    await this.appManager.remove(this.device.name, pkg.id);
    progress.close(true);
  }
}
