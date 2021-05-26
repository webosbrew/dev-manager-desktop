import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Device, DeviceEditSpec } from '../../../types/novacom';
import { DeviceManagerService } from '../../core/services/device-manager/device-manager.service';
import { ElectronService } from '../../core/services/electron/electron.service';
import { SetupStep } from '../device-setup.component';

@Component({
  selector: 'app-info',
  templateUrl: './info.component.html',
  styleUrls: ['./info.component.scss']
})
export class InfoComponent implements OnInit, SetupStep {

  formGroup: FormGroup;

  isLastStep: boolean = false;

  constructor(
    private electron: ElectronService,
    private deviceManager: DeviceManagerService,
    fb: FormBuilder,
  ) {
    this.formGroup = fb.group({
      name: ['tv', Validators.required],
      address: ['', Validators.required],
      port: ['9922', Validators.required],
      description: [],
      // Unix username Regex: https://unix.stackexchange.com/a/435120/277731
      sshUsername: ['prisoner', Validators.pattern(/^[a-z_]([a-z0-9_-]{0,31}|[a-z0-9_-]{0,30}\$)$/)],
      sshAuth: ['devKey', Validators.required],
      sshPassword: [],
      sshPrivkey: [],
      sshPrivkeyPassphrase: [],
    });
  }

  ngOnInit(): void {
  }

  get sshAuth(): string | null {
    return this.formGroup.get('sshAuth').value;
  }

  get canContinue(): boolean {
    return this.formGroup.valid;
  }

  get setupInfo(): SetupInfo {
    return this.formGroup.value as SetupInfo;
  }

  async onContinue(): Promise<void> {
    let path = this.electron.path;
    let fs = this.electron.fs;
    let ssh2 = this.electron.ssh2;
    let value = this.setupInfo;
    let spec = toDeviceSpec(value);
    if (value.sshAuth == 'devKey') {
      let keyPath = path.join(path.resolve(process.env.HOME || process.env.USERPROFILE, '.ssh'), spec.privateKey.openSsh);
      if (fs.existsSync(keyPath)) {
        // Show alert to prompt for overwrite
        if (!await this.confirmOverwritePrivKey(spec.privateKey.openSsh)) {
          return;
        }
      }
      // Fetch SSH privKey
      let privKey = await this.deviceManager.getPrivKey(value.address);
      // Throw error if key parse failed
      ssh2.utils.parseKey(privKey, spec.passphrase);
      fs.writeFileSync(keyPath, privKey);
    }
    let added = await this.deviceManager.addDevice(spec);
    try {
      this.deviceManager.deviceInfo(added.name);
    } catch (e) {
      // Something wrong happened. Ask user if they want to delete added device
      if (!await this.confirmVerififcationFailure(added, e)) {
        await this.deviceManager.removeDevice(added.name);
      }
    }
    // Close setup wizard
  }

  private async confirmOverwritePrivKey(name: string): Promise<boolean> {
    return false;
  }

  private async confirmVerififcationFailure(added: Device, e: Error): Promise<boolean> {
    return true;
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
  var spec: DeviceEditSpec = {
    name: value.name,
    port: value.port,
    host: value.address,
    username: value.sshUsername,
    profile: 'ose'
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
