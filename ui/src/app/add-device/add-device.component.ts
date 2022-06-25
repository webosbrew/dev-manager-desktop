import {Component} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {NgbActiveModal, NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {Device, DeviceEditSpec, DevicePrivateKey} from '../../../../main/types';
import {DeviceManagerService} from '../core/services';
import {
  MessageDialogComponent,
  MessageDialogConfig
} from '../shared/components/message-dialog/message-dialog.component';
import {ProgressDialogComponent} from '../shared/components/progress-dialog/progress-dialog.component';
import {KeyserverHintComponent} from './keyserver-hint/keyserver-hint.component';
import {ConnHintComponent} from './conn-hint/conn-hint.component';

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
      description: [],
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
    this.doAddDevice().catch(error => {
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
    const spec = toDeviceSpec(value);
    await this.testConnectivity(value);
    if (value.sshAuth == 'devKey') {
      let writePrivKey = true;
      const privateKey = spec.privateKey!;
      if (await this.deviceManager.hasPrivKey(privateKey.openSsh)) {
        // Show alert to prompt for overwrite
        writePrivKey = await this.confirmOverwritePrivKey(privateKey.openSsh);
      }
      if (writePrivKey) {
        // Fetch SSH privKey
        const privKey = await this.fetchPrivKey(value);
        await this.deviceManager.savePrivKey(privateKey.openSsh, privKey);
      }
    }
    const added = await this.deviceManager.addDevice(spec);
    try {
      console.log(added);
      const info = await this.deviceManager.osInfo(added.name);
      console.log(info);
    } catch (e) {
      console.log('Failed to get device info', e);
      // Something wrong happened. Ask user if they want to delete added device
      if (!await this.confirmVerificationFailure(added, e as Error)) {
        await this.deviceManager.removeDevice(added.name);
      }
    }
    // Close setup wizard
    this.modal.close(added);
    return added;
  }

  private async confirmOverwritePrivKey(name: string): Promise<boolean> {
    const ref = MessageDialogComponent.open(this.modalService, {
      title: 'Overwrite Private Key',
      message: 'Private key with same name already exists. Do you want to overwrite it?',
      positive: 'OK',
      negative: 'Cancel',
    });
    return await ref.result;
  }

  private async testConnectivity(info: SetupInfo): Promise<void> {
    try {
      await this.deviceManager.checkConnectivity(info.address, info.port);
    } catch (e) {
      const config: MessageDialogConfig = {
        title: 'Unable to connect to device',
        message: ConnHintComponent,
        positive: 'OK',
      };
      throw config;
    }
  }

  private async fetchPrivKey(info: SetupInfo): Promise<DevicePrivateKey> {
    let retryCount = 0;
    while (retryCount < 3) {
      try {
        return await this.deviceManager.fetchPrivKey(info.address, info.sshPrivkeyPassphrase);
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

  private async confirmVerificationFailure(added: Device, e: Error): Promise<boolean> {
    const ref = MessageDialogComponent.open(this.modalService, {
      title: 'Verification Failed',
      message: 'Add this device anyway?',
      positive: 'OK',
      negative: 'Cancel',
    });
    return await ref.result;
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

function toDeviceSpec(value: SetupInfo): DeviceEditSpec {
  const spec: DeviceEditSpec = {
    name: value.name,
    port: value.port,
    host: value.address,
    username: value.sshUsername,
    profile: 'ose',
    default: true
  };
  switch (value.sshAuth) {
    case 'password': {
      spec.password = value.sshPassword;
      break;
    }
    case 'devKey': {
      spec.privateKey = {openSsh: `${value.name}_webos`};
      spec.passphrase = value.sshPrivkeyPassphrase;
      break;
    }
    case 'localKey': {
      spec.privateKey = {openSsh: value.sshPrivkey!};
      spec.passphrase = value.sshPrivkeyPassphrase;
      break;
    }
  }
  return spec;
}
