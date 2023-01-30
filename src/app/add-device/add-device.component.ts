import {Component} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {NgbActiveModal, NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {DeviceManagerService} from '../core/services';
import {MessageDialogComponent} from '../shared/components/message-dialog/message-dialog.component';
import {ProgressDialogComponent} from '../shared/components/progress-dialog/progress-dialog.component';
import {KeyserverHintComponent} from './keyserver-hint/keyserver-hint.component';
import {Device, NewDevice, NewDeviceAuthentication, NewDeviceBase} from "../types";

@Component({
  selector: 'app-info',
  templateUrl: './add-device.component.html',
  styleUrls: ['./add-device.component.scss']
})
export class AddDeviceComponent {

  formGroup: FormGroup;

  constructor(
    public modal: NgbActiveModal,
    private modalService: NgbModal,
    private deviceManager: DeviceManagerService,
    fb: FormBuilder,
  ) {
    this.formGroup = fb.group({
      name: ['tv', Validators.pattern(/^[_a-zA-Z][a-zA-Z0-9#_-]*/)],
      address: ['', Validators.pattern(/^(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))$/)],
      port: [9922],
      description: [undefined],
      // Unix username Regex: https://unix.stackexchange.com/a/435120/277731
      sshUsername: ['prisoner', Validators.pattern(/^[a-z_]([a-z0-9_-]{0,31}|[a-z0-9_-]{0,30}\$)$/)],
      sshAuth: ['devKey'],
      sshPassword: [],
      sshPrivkey: [],
      sshPrivkeyPassphrase: [''],
    });
  }

  get sshAuth(): string | null {
    return this.formGroup.get('sshAuth')!.value;
  }

  get setupInfo(): SetupInfo {
    return this.formGroup.value as SetupInfo;
  }

  addDevice(): void {
    const progress = ProgressDialogComponent.open(this.modalService);
    this.doAddDevice().then(device => {
      // Close setup wizard
      this.modal.close(device);
    }).catch(error => {
      if (error instanceof Error) {
        MessageDialogComponent.open(this.modalService, {
          title: 'Failed to add device',
          message: error.message,
          positive: 'OK',
        });
      } else if (error.positive) {
        MessageDialogComponent.open(this.modalService, error);
      }
    }).finally(() => {
      progress.close(true);
    });
  }

  private async doAddDevice(): Promise<Device> {
    const value = this.setupInfo;
    const newDevice = await this.toNewDevice(value);
    try {
      console.log(newDevice);
      const info = await this.deviceManager.getSystemInfo(newDevice);
      console.log(info);
    } catch (e) {
      console.log('Failed to get device info:', e);
      // Something wrong happened. Abort adding by default
      if (!await this.confirmVerificationFailure(newDevice, e as Error)) {
        throw e;
      }
    }
    return await this.deviceManager.addDevice(newDevice);
  }

  private async fetchPrivKey(address: string, passphrase: string): Promise<string> {
    let retryCount = 0;
    while (retryCount < 3) {
      try {
        return await this.deviceManager.novacomGetKey(address, passphrase);
      } catch (e) {
        const confirm = MessageDialogComponent.open(this.modalService, {
          title: 'Failed to fetch private key',
          message: KeyserverHintComponent,
          positive: 'Retry',
          negative: 'Cancel',
        });
        if (await confirm.result) {
          retryCount++;
          continue;
        }
        throw e;
      }
    }
    throw new Error('Shouldn\'t been here');
  }

  private async confirmVerificationFailure(device: NewDevice, e: Error): Promise<boolean> {
    const ref = MessageDialogComponent.open(this.modalService, {
      title: 'Verification Failed',
      message: `Add ${device.name} anyway?`,
      error: e,
      positive: 'OK',
      negative: 'Cancel',
    });
    return await ref.result;
  }

  private async toNewDevice(value: SetupInfo): Promise<NewDevice> {
    const base: NewDeviceBase = {
      new: true,
      profile: 'ose',
      name: value.name,
      description: value.description,
      port: value.port,
      host: value.address,
      username: value.sshUsername,
    };
    switch (value.sshAuth) {
      case 'password': {
        return {...base, password: value.sshPassword!};
      }
      case 'devKey': {
        return {
          ...base, privateKey: {
            openSshData: await this.fetchPrivKey(value.address, value.sshPrivkeyPassphrase!),
          }, passphrase: value.sshPrivkeyPassphrase!
        };
      }
      case 'localKey': {
        return {
          ...base, privateKey: {
            openSsh: value.sshPrivkey!,
          }, passphrase: value.sshPrivkeyPassphrase
        };
      }
    }
  }

}

interface SetupInfo {
  name: string;
  address: string;
  port: number;
  description?: string;
  sshUsername: string;
  sshAuth: NewDeviceAuthentication;
  sshPassword?: string;
  sshPrivkey?: string;
  sshPrivkeyPassphrase?: string;
}
