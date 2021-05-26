import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DeviceManagerService } from '../core/services/device-manager/device-manager.service';
import { InstallManagerService } from '../core/services/install-manager/install-manager.service';

@Component({
  selector: 'app-device-list',
  templateUrl: './device-list.component.html',
  styleUrls: ['./device-list.component.scss']
})
export class DeviceListComponent implements OnInit {

  constructor(
    private deviceManager: DeviceManagerService,
    private installManager: InstallManagerService,
    private router: Router
  ) { }

  ngOnInit(): void {
  }

  removeDevice(name: string) {
    this.deviceManager.removeDevice(name).catch(reason => {
      console.log(reason);
    });
  }

  markDefault(name: string) {
    this.deviceManager.setDefault(name).catch(reason => {
      console.log(reason);
    });
  }

  installHbChannel(name: string) {
    this.installManager.list(name).then(result => {
      console.log(result);
    }).catch(reason => {
      console.log(reason);
    });
  }

  openSetupDevice() {
    this.router.navigateByUrl('/devices/setup');
  }
}
