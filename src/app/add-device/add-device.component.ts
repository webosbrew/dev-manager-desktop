import {Component} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {NgbActiveModal, NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {DeviceManagerService} from '../core/services';
import {
  MessageDialogComponent,
  MessageDialogConfig
} from '../shared/components/message-dialog/message-dialog.component';
import {ProgressDialogComponent} from '../shared/components/progress-dialog/progress-dialog.component';
import {KeyserverHintComponent} from './keyserver-hint/keyserver-hint.component';
import {ConnHintComponent} from './conn-hint/conn-hint.component';
import {Device, NewDevice, NewDeviceBase} from "../types";

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
      name: ['tv'],
      address: [''],
      port: ['9922'],
      description: [''],
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
    await this.testConnectivity(newDevice);
    try {
      console.log(newDevice);
      const info = await this.deviceManager.getSystemInfo(newDevice);
      console.log(info);
    } catch (e) {
      console.log('Failed to get device info', e);
      // Something wrong happened. Abort adding by default
      if (!await this.confirmVerificationFailure(newDevice, e as Error)) {
        throw e;
      }
    }
    return await this.deviceManager.addDevice(newDevice);
  }

  private async testConnectivity(device: NewDevice): Promise<void> {
    try {
      await this.deviceManager.checkConnectivity(device);
    } catch (e) {
      const config: MessageDialogConfig = {
        title: 'Unable to connect to device',
        message: ConnHintComponent,
        positive: 'OK',
      };
      throw config;
    }
  }

  private async fetchPrivKey(address: string, passphrase: string): Promise<string> {
    let retryCount = 0;
    while (retryCount < 3) {
      try {
        return await this.deviceManager.fetchPrivKey(address, passphrase);
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
      message: 'Add this device anyway?',
      positive: 'OK',
      negative: 'Cancel',
    });
    return await ref.result;
  }

  private async toNewDevice(value: SetupInfo): Promise<NewDevice> {
    const base: NewDeviceBase = {
      profile: 'ose',
      name: value.name,
      description: value.description,
      port: value.port,
      host: value.address,
      username: value.sshUsername,
    };
    switch (value.sshAuth) {
      case 'password': {
        return {...base, newAuth: 'password', password: value.sshPassword!};
      }
      case 'devKey': {
        return {
          ...base, newAuth: 'devKey', privateKey: {
            openSshData: await this.fetchPrivKey(value.address, value.sshPrivkeyPassphrase!),
          }, passphrase: value.sshPrivkeyPassphrase
        };
      }
      case 'localKey': {
        return {
          ...base, newAuth: 'localKey', privateKey: {
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
  sshAuth: 'password' | 'devKey' | 'localKey';
  sshPassword?: string;
  sshPrivkey?: string;
  sshPrivkeyPassphrase?: string;
}
