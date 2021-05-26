import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DeviceManagerService } from '../core/services/device-manager/device-manager.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AddDeviceComponent } from '../add-device/add-device.component';
import { Device } from '../../types/novacom';
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  selectedDevice?: Device;

  constructor(
    public deviceManager: DeviceManagerService,
    private modalService: NgbModal,
    private router: Router
  ) {
    deviceManager.devices$.subscribe((devices) => {
      this.selectedDevice = devices.find((device) => device.default);
    })
  }

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
    this.modalService.open(AddDeviceComponent, { size: 'lg', centered: true, scrollable: true });
  }
}
