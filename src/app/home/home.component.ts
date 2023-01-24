import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {Device} from '../types';
import {AddDeviceComponent} from '../add-device/add-device.component';
import {DeviceManagerService} from '../core/services';
import {MessageDialogComponent} from '../shared/components/message-dialog/message-dialog.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {

  selectedDevice?: Device;
  activeItem: string = 'apps';

  constructor(
    public deviceManager: DeviceManagerService,
    private modalService: NgbModal,
    private router: Router
  ) {
    deviceManager.devices$.subscribe((devices) => {
      this.selectedDevice = devices.find((device) => device.default);
    });
  }

  async removeDevice(name: string): Promise<void> {
    try {
      const ref = MessageDialogComponent.open(this.modalService, {
        title: 'Remove device',
        message: `Remove device \"${name}\"?`,
        positive: 'Remove',
        positiveStyle: 'danger',
        negative: 'Cancel'
      });
      if (!await ref.result) {
        return;
      }
    } catch (e) {
      return;
    }
    await this.deviceManager.removeDevice(name);
  }

  markDefault(name: string): void {
    this.deviceManager.setDefault(name).catch(reason => {
      console.log(reason);
    });
  }

  openSetupDevice(): void {
    this.modalService.open(AddDeviceComponent, {size: 'lg', centered: true, scrollable: true});
  }
}
