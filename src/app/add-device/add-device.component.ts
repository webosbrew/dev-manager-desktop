import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { Device, DeviceEditSpec } from '../../types/novacom';
import { DeviceManagerService, ElectronService } from '../core/services';
import { MessageDialogComponent, MessageDialogConfig } from '../shared/components/message-dialog/message-dialog.component';
import { ProgressDialogComponent } from '../shared/components/progress-dialog/progress-dialog.component';
import { KeyserverHintComponent } from './keyserver-hint/keyserver-hint.component';
import { ConnHintComponent } from './conn-hint/conn-hint.component';
@Component({
  selector: 'app-info',
  templateUrl: './add-device.component.html',
  styleUrls: ['./add-device.component.scss']
})
export class AddDeviceComponent implements OnInit {

  formGroup: FormGroup;

  constructor(
    public modal: NgbActiveModal,
    private modalService: NgbModal,
    private translate: TranslateService,
    private electron: ElectronService,
    private deviceManager: DeviceManagerService,
    fb: FormBuilder,
  ) {
    this.formGroup = fb.group({
      name: ['tv'],
      address: ['127.0.0.1'],
      port: ['9922'],
      description: [],
      // Unix username Regex: https://unix.stackexchange.com/a/435120/277731
      sshUsername: ['prisoner', Validators.pattern(/^[a-z_]([a-z0-9_-]{0,31}|[a-z0-9_-]{0,30}\$)$/)],
      sshAuth: ['devKey'],
      sshPassword: [],
      sshPrivkey: [],
      sshPrivkeyPassphrase: ['114514'],
    });
  }

  ngOnInit(): void {
  }

  get sshAuth(): string | null {
    return this.formGroup.get('sshAuth').value;
  }

  get setupInfo(): SetupInfo {
    return this.formGroup.value as SetupInfo;
  }

  addDevice(): void {
    const progress = ProgressDialogComponent.open(this.modalService);
    this.doAddDevice().catch(error => {
      if (error instanceof Error) {
        MessageDialogComponent.open(this.modalService, {
          title: this.translate.instant('MESSAGES.TITLE_ADD_DEVICE_FAILED'),
          message: this.translate.instant('MESSAGES.ERROR_ADD_DEVICE_FAILED', { error: error.message }),
          positive: this.translate.instant('ACTIONS.OK'),
        });
      } else if (error.positive) {
        MessageDialogComponent.open(this.modalService, error);
      }
    }).finally(() => {
      progress.close(true);
    });
  }

  private async doAddDevice(): Promise<Device> {
    const path = this.electron.path;
    const fs = this.electron.fs;
    const ssh2 = this.electron.ssh2;
    const value = this.setupInfo;
    const spec = toDeviceSpec(value);
    await this.testConnectivity(value);
    if (value.sshAuth == 'devKey') {
      const keyPath = path.join(path.resolve(process.env.HOME || process.env.USERPROFILE, '.ssh'), spec.privateKey.openSsh);
      let writePrivKey = true;
      if (fs.existsSync(keyPath)) {
        // Show alert to prompt for overwrite
        writePrivKey = await this.confirmOverwritePrivKey(spec.privateKey.openSsh);
      }
      if (writePrivKey) {
        // Fetch SSH privKey
        const privKey = await this.fetchPrivKey(value);
        // Throw error if key parse failed
        ssh2.utils.parseKey(privKey, spec.passphrase);
        fs.writeFileSync(keyPath, privKey);
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
      if (!await this.confirmVerificationFailure(added, e)) {
        await this.deviceManager.removeDevice(added.name);
      }
    }
    // Close setup wizard
    this.modal.close(added);
    return added;
  }

  private async confirmOverwritePrivKey(name: string): Promise<boolean> {
    const ref = MessageDialogComponent.open(this.modalService, {
      title: this.translate.instant('MESSAGES.TITLE_OVERWRITE_PRIVKEY'),
      message: this.translate.instant('MESSAGES.CONFIRM_OVERWRITE_PRIVKEY', { name }),
      positive: this.translate.instant('ACTIONS.OK'),
      negative: this.translate.instant('ACTIONS.CANCEL'),
    });
    return await ref.result;
  }

  private async testConnectivity(info: SetupInfo): Promise<void> {
    try {
      await this.deviceManager.checkConnectivity(info.address, info.port);
    } catch (e) {
      const config: MessageDialogConfig = {
        title: this.translate.instant('MESSAGES.TITLE_DEVICE_CONN_FAILED'),
        message: ConnHintComponent,
        positive: this.translate.instant('ACTIONS.OK'),
      };
      throw config;
    }
  }

  private async fetchPrivKey(info: SetupInfo) {
    let retryCount = 0;
    while (retryCount < 3) {
      try {
        return await this.deviceManager.getPrivKey(info.address);
      } catch (e) {
        const confirm = MessageDialogComponent.open(this.modalService, {
          title: this.translate.instant('MESSAGES.TITLE_KEYSERV_FETCH_RETRY'),
          message: KeyserverHintComponent,
          positive: this.translate.instant('ACTIONS.RETRY'),
          negative: this.translate.instant('ACTIONS.CANCEL'),
        });
        if (await confirm.result) {
          retryCount++;
          continue;
        }
        throw e;
      }
    }
  }

  private async confirmVerificationFailure(added: Device, e: Error): Promise<boolean> {
    const ref = MessageDialogComponent.open(this.modalService, {
      title: this.translate.instant('MESSAGES.TITLE_VERIFICATION_FAILED'),
      message: this.translate.instant('MESSAGES.CONFIRM_VERIFICATION_FAILED'),
      positive: this.translate.instant('ACTIONS.OK'),
      negative: this.translate.instant('ACTIONS.CANCEL'),
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
      spec.privateKey = { openSsh: `${value.name}_webos` };
      spec.passphrase = value.sshPrivkeyPassphrase;
      break;
    }
    case 'localKey': {
      spec.privateKey = { openSsh: value.sshPrivkey };
      spec.passphrase = value.sshPrivkeyPassphrase;
      break;
    }
  }
  return spec;
}
