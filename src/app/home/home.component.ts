import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {Device} from '../types';
import {AddDeviceComponent} from '../add-device/add-device.component';
import {DeviceManagerService} from '../core/services';
import {MessageDialogComponent} from '../shared/components/message-dialog/message-dialog.component';
import {RemoveConfirmation, RemoveDeviceComponent} from "../remove-device/remove-device.component";
import packageInfo from '../../../package.json';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {

  selectedDevice?: Device;
  activeItem: string = 'apps';
  appVersion: string;

  constructor(
    public deviceManager: DeviceManagerService,
    private modalService: NgbModal,
    private router: Router
  ) {
    deviceManager.devices$.subscribe((devices) => {
      this.selectedDevice = devices.find((device) => device.default) || devices[0];
    });
    this.appVersion = packageInfo.version;
  }

  async removeDevice(device: Device): Promise<void> {
    let answer: RemoveConfirmation;
    try {
      let a = await RemoveDeviceComponent.confirm(this.modalService, device);
      if (!a) {
        return;
      }
      answer = a;
    } catch (e) {
      return;
    }
    await this.deviceManager.removeDevice(device.name, answer.deleteSshKey);
  }

  markDefault(device: Device): void {
    this.deviceManager.setDefault(device.name).catch(reason => {
      console.log(reason);
    });
  }

  openSetupDevice(): void {
    const ref = this.modalService.open(AddDeviceComponent, {size: 'lg', centered: true, scrollable: true});
    ref.result.then((device) => this.deviceManager.setDefault(device.name));
  }
}
