import {Component, Injector, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {Device} from '../types';
import {DeviceManagerService} from '../core/services';
import {RemoveConfirmation, RemoveDeviceComponent} from "../remove-device/remove-device.component";
import packageInfo from '../../../package.json';
import {WizardComponent} from "../add-device/wizard/wizard.component";
import {noop} from "rxjs";
import {filter} from "rxjs/operators";
import {isNonNull} from "../shared/operators";

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
    private modalService: NgbModal
  ) {
    deviceManager.devices$.pipe(filter(isNonNull)).subscribe((devices) => {
      this.selectedDevice = devices.find((device) => device.default) || devices[0];
      if (!this.selectedDevice) {
        this.openSetupDevice(false);
      }
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

  openSetupDevice(cancellable: boolean): void {
    const ref = this.modalService.open(WizardComponent, {
      size: 'xl', centered: true, scrollable: true,
      injector: Injector.create({
        providers: [
          {provide: 'cancellable', useValue: cancellable}
        ]
      }),
      beforeDismiss: () => cancellable,
    });
    ref.result.then((device) => this.deviceManager.setDefault(device.name)).catch(noop);
  }
}
