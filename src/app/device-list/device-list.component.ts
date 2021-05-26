import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DeviceManagerService } from '../core/services/device-manager/device-manager.service';

@Component({
  selector: 'app-device-list',
  templateUrl: './device-list.component.html',
  styleUrls: ['./device-list.component.scss']
})
export class DeviceListComponent implements OnInit {

  constructor(
    public deviceManager: DeviceManagerService,
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

  openSetupDevice() {
    this.router.navigateByUrl('/devices/setup');
  }
}
