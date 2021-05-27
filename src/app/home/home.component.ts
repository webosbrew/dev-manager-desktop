import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DeviceManagerService } from '../core/services/device-manager/device-manager.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AddDeviceComponent } from '../add-device/add-device.component';
import { Device } from '../../types/novacom';
import { MessageDialogComponent } from '../shared/components/message-dialog/message-dialog.component';
import { TranslateService } from '@ngx-translate/core';
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
    private router: Router,
    private translate: TranslateService,
  ) {
    deviceManager.devices$.subscribe((devices) => {
      this.selectedDevice = devices.find((device) => device.default);
    })
  }

  ngOnInit(): void {
  }

  async removeDevice(name: string) {
    try {
      let ref = MessageDialogComponent.open(this.modalService, {
        title: this.translate.instant('MESSAGES.TITLE_REMOVE_DEVICE'),
        message: this.translate.instant('MESSAGES.CONFIRM_REMOVE_DEVICE', { name })
      });
      if (!await ref.result) {
        return;
      }
    } catch (e) {
      return;
    }
    await this.deviceManager.removeDevice(name);
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
