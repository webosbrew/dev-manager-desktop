import { Component, OnInit } from '@angular/core';
import { Device } from '../../../../types/novacom';
import { DeviceManagerService } from '../../../core/services/device-manager/device-manager.service';
import { InstallManagerService, PackageInfo } from '../../../core/services/install-manager/install-manager.service';

@Component({
  selector: 'app-apps',
  templateUrl: './apps.component.html',
  styleUrls: ['./apps.component.scss']
})
export class AppsComponent implements OnInit {

  packages: PackageInfo[];
  device: Device;
  constructor(
    private deviceManager: DeviceManagerService,
    private installManager: InstallManagerService
  ) {
    deviceManager.devices$.subscribe((devices) => {
      let device = devices.find((dev) => dev.default);
      if (device) {
        this.installManager.list(device.name).then(pkgs => {
          this.packages = pkgs;
        });
      } else {
        this.packages = [];
      }
      this.device = device;
    });
  }

  ngOnInit(): void {
  }

}
