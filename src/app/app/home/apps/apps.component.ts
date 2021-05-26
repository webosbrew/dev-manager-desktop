import { Component, OnInit } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Device } from '../../../../types/novacom';
import { DeviceManagerService } from '../../../core/services/device-manager/device-manager.service';
import { InstallManagerService, PackageInfo } from '../../../core/services/install-manager/install-manager.service';

@Component({
  selector: 'app-apps',
  templateUrl: './apps.component.html',
  styleUrls: ['./apps.component.scss']
})
export class AppsComponent implements OnInit {

  packages$: Observable<PackageInfo[]>;
  device: Device;
  constructor(
    private deviceManager: DeviceManagerService,
    private installManager: InstallManagerService
  ) {
    deviceManager.devices$.subscribe((devices) => {
      let device = devices.find((dev) => dev.default);
      if (device) {
        this.packages$ = this.installManager.packages$(device.name);
        this.installManager.load(device.name);
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

  dropFiles(event: DragEvent): void {
    console.log('dropFiles', event, event.dataTransfer.files);
    const files = event.dataTransfer.files;
    if (files.length != 1 || !files[0].name.endsWith('.ipk')) {
      // Show error
      return;
    }
    const file = files[0];
    this.installManager.install(this.device.name, file.path).then(() => {
      console.log('Package installed');
    });
  }

  removePackage(id: string) {
    this.installManager.remove(this.device.name, id).then(() => {
      console.log(`Package ${id} removed`);
    })
  }
}
