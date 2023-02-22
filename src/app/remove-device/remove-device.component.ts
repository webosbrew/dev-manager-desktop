import {Component, Inject, Injector} from '@angular/core';
import {NgbActiveModal, NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {Device} from "../types";

@Component({
  selector: 'app-remove-device',
  templateUrl: './remove-device.component.html',
  styleUrls: ['./remove-device.component.scss']
})
export class RemoveDeviceComponent {

  public deleteSshKey: boolean = false;

  constructor(@Inject('device') public device: Device, public modal: NgbActiveModal) {
  }

  get canDeleteSshKey(): boolean {
    return this.device.privateKey?.openSsh?.startsWith("webos_") === true;
  }

  confirmDeletion() {
    this.modal.close({
      deleteSshKey: this.deleteSshKey,
    });
  }

  static confirm(service: NgbModal, device: Device): Promise<RemoveConfirmation | null> {
    return service.open(RemoveDeviceComponent, {
      centered: true,
      size: 'lg',
      scrollable: true,
      injector: Injector.create({
        providers: [{provide: 'device', useValue: device}]
      })
    }).result;
  }
}

export interface RemoveConfirmation {
  deleteSshKey: boolean;
}
