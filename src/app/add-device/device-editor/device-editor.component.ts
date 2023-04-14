import {Component, Input, OnInit} from '@angular/core';
import {FormControl, FormGroup, ValidationErrors, Validators} from '@angular/forms';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {DeviceManagerService} from '../../core/services';
import {MessageDialogComponent} from '../../shared/components/message-dialog/message-dialog.component';
import {KeyserverHintComponent} from '../keyserver-hint/keyserver-hint.component';
import {NewDevice, NewDeviceAuthentication, NewDeviceBase} from "../../types";
import {noop, Observable, of} from "rxjs";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {open as showOpenDialog} from '@tauri-apps/api/dialog';
import {homeDir} from '@tauri-apps/api/path';
import {path} from "@tauri-apps/api";
import {BackendError} from "../../core/services/backend-client";
import {KeyPassphrasePromptComponent} from "./key-passphrase-prompt/key-passphrase-prompt.component";
import {SshPrivkeyHintComponent} from "./ssh-privkey-hint/ssh-privkey-hint.component";
import {DevmodePassphraseHintComponent} from "./devmode-passphrase-hint/devmode-passphrase-hint.component";
import {SshPasswordHintComponent} from "./ssh-password-hint/ssh-password-hint.component";

@Component({
  selector: 'app-device-editor',
  templateUrl: './device-editor.component.html',
  styleUrls: ['./device-editor.component.scss']
})
export class DeviceEditorComponent implements OnInit {

  formGroup!: FormGroup<SetupInfoFormControls>;

  @Input()
  port?: number;
  @Input()
  username?: string;
  @Input()
  auth?: NewDeviceAuthentication;
  @Input()
  checkName?: boolean;
  @Input()
  hideDevModeAuth?: boolean;

  constructor(private modalService: NgbModal, private deviceManager: DeviceManagerService) {
  }

  ngOnInit(): void {
    this.formGroup = new FormGroup<SetupInfoFormControls>({
      name: new FormControl<string>('tv', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(/^[_a-zA-Z][a-zA-Z0-9#_-]*/),
        ],
        asyncValidators: (control) => this.validateDeviceName(control.value)
      }),
      address: new FormControl<string>('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(/^(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))$/)
        ]
      }),
      port: new FormControl<number | null>(this.port ?? null, {
        nonNullable: false,
        validators: [
          Validators.required,
          Validators.min(0),
          Validators.max(65535)
        ]
      }),
      description: new FormControl<string>('', {
        nonNullable: true
      }),
      // Unix username Regex: https://unix.stackexchange.com/a/435120/277731
      sshUsername: new FormControl<string>(this.username ?? '', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(/^[a-z_]([a-z0-9_-]{0,31}|[a-z0-9_-]{0,30}\$)$/)
        ]
      }),
      sshAuth: new FormGroup<SetupAuthInfoFormControls>({
        type: new FormControl<NewDeviceAuthentication>(this.auth ?? NewDeviceAuthentication.LocalKey, {
          nonNullable: true
        }),
        value: new FormControl<string | SetupAuthInfoLocalKey['value'] | null>(null),
      }, {
        asyncValidators: (c) => this.validateAuthInfo(c.value),
      }),
    });
    if (this.username) {
      this.formGroup.controls.sshUsername.disable();
    }
    if (this.port) {
      this.formGroup.controls.port.disable();
    }
    if (this.auth) {
      this.formGroup.controls.sshAuth.controls.type.disable();
    }
    this.formGroup.controls.sshAuth.controls.type.valueChanges.subscribe(() => {
      this.formGroup.controls.sshAuth.controls.value.reset(null);
    });
  }

  async submit(): Promise<NewDevice> {
    const newDevice = await this.getNewDevice();
    try {
      console.log(newDevice);
      const info = await this.deviceManager.getSystemInfo(newDevice);
      console.log(info);
    } catch (e) {
      console.warn('Failed to get device info:', e);
      // Something wrong happened. Abort adding by default
      if (!await this.confirmVerificationFailure(newDevice, e as Error)) {
        throw e;
      }
    }
    return newDevice;
  }

  private async fetchPrivateKey(address: string, passphrase?: string): Promise<string> {
    let retryCount = 0;
    while (retryCount < 3) {
      try {
        return await this.deviceManager.novacomGetKey(address, passphrase);
      } catch (e) {
        if (BackendError.isCompatible(e) && (e.reason == 'BadPassphrase' || e.reason == 'PassphraseRequired')) {
          await MessageDialogComponent.open(this.modalService, {
            title: 'Failed to verify private key',
            message: 'Please make sure the passphrase is correct, it usually has 6 characters and is case sensitive.',
            positive: 'OK',
          }).result.catch(noop);
          throw e;
        }
        const confirm = MessageDialogComponent.open(this.modalService, {
          title: 'Failed to fetch private key',
          message: KeyserverHintComponent,
          error: e as Error,
          positive: 'Retry',
          negative: 'Cancel',
          cancellable: false,
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

  get valid(): boolean {
    return this.formGroup.valid;
  }

  private async confirmVerificationFailure(device: NewDevice, e: Error): Promise<boolean> {
    const ref = MessageDialogComponent.open(this.modalService, {
      title: 'Verification Failed',
      message: `Add ${device.name} anyway?`,
      error: e,
      positive: 'OK',
      negative: 'Cancel',
    });
    return await ref.result.catch(() => false);
  }

  private async getNewDevice(): Promise<NewDevice> {
    if (!this.formGroup.valid) {
      throw new Error('Missing required fields');
    }
    const value = this.formGroup.getRawValue() as SetupInfo;
    const base: NewDeviceBase = {
      new: true,
      profile: 'ose',
      name: value.name,
      description: value.description,
      port: value.port!,
      host: value.address,
      username: value.sshUsername,
    };
    switch (value.sshAuth.type) {
      case NewDeviceAuthentication.Password: {
        return {
          ...base,
          password: value.sshAuth.value
        };
      }
      case NewDeviceAuthentication.DevKey: {
        return {
          ...base,
          privateKey: {
            openSshData: await this.fetchPrivateKey(value.address, value.sshAuth.value),
          },
          passphrase: value.sshAuth.value
        };
      }
      case NewDeviceAuthentication.LocalKey: {
        return {
          ...base,
          privateKey: {
            openSsh: value.sshAuth.value.path,
          },
          passphrase: value.sshAuth.value.passphrase
        };
      }
      default: {
        throw new Error('Bad auth type');
      }
    }
  }

  private validateDeviceName(name: string): Observable<null | ValidationErrors> {
    if (!name) {
      return of(null);
    }
    return fromPromise(this.deviceManager.list()
      .then(devices => devices.find(device => device.name === name))
      .then(device => device ? {nameExists: true} : null));
  }

  private async validateAuthInfo(auth: SetupAuthInfoUnion): Promise<null | ValidationErrors> {
    switch (auth.type) {
      case NewDeviceAuthentication.Password:
        return auth.value ? null : {PasswordRequired: true};
      case NewDeviceAuthentication.LocalKey:
        if (!auth.value) {
          return {PrivKeyRequired: true};
        }
        return this.deviceManager.verifyLocalPrivateKey(auth.value.path, auth.value.passphrase)
          .then(() => null).catch(e => {
            if (BackendError.isCompatibleBody(e)) {
              return {[e.reason]: true};
            }
            console.error(e);
            throw e;
          });
      case NewDeviceAuthentication.DevKey:
        return auth.value ? null : {PassphraseRequired: true};

    }
  }

  async chooseSshPrivKey(): Promise<void> {
    const sshDir = await path.join(await homeDir(), '.ssh');
    const file = await showOpenDialog({
      defaultPath: sshDir,
    });
    if (typeof (file) !== 'string' || !file) {
      return;
    }
    let passphrase: string | undefined = undefined;
    try {
      await this.deviceManager.verifyLocalPrivateKey(file);
    } catch (e) {
      if (!BackendError.isCompatibleBody(e)) {
        throw e;
      }
      if (e.reason === 'PassphraseRequired') {
        passphrase = await KeyPassphrasePromptComponent.prompt(this.modalService, file);
      }
      if (!passphrase) {
        MessageDialogComponent.open(this.modalService, {
          message: 'Failed to open private key',
          error: e as any,
          positive: 'OK'
        });
        return;
      }
    }
    this.formGroup.controls.sshAuth.controls.value.setValue({
      path: file, passphrase
    });
  }

  authInfoHelp() {
    switch (this.formGroup.controls.sshAuth.controls.type.getRawValue()) {
      case NewDeviceAuthentication.DevKey: {
        MessageDialogComponent.open(this.modalService, {
          message: DevmodePassphraseHintComponent,
          positive: 'Close'
        });
        break;
      }
      case NewDeviceAuthentication.LocalKey: {
        MessageDialogComponent.open(this.modalService, {
          message: SshPrivkeyHintComponent,
          positive: 'Close'
        });
        break;
      }
      case NewDeviceAuthentication.Password: {
        MessageDialogComponent.open(this.modalService, {
          message: SshPasswordHintComponent,
          positive: 'Close'
        });
        break;
      }
    }
  }
}

interface SetupInfo {
  name: string;
  address: string;
  port: number | null;
  description: string;
  sshUsername: string;
  sshAuth: SetupAuthInfoUnion;
}


type SetupInfoFormControls = {
  name: FormControl<string>;
  address: FormControl<string>;
  port: FormControl<number | null>;
  description: FormControl<string>;
  sshUsername: FormControl<string>;
  sshAuth: FormGroup<SetupAuthInfoFormControls>;
};

interface SetupAuthInfoBase {
  type: NewDeviceAuthentication;
}

export interface SetupAuthInfoPassword extends SetupAuthInfoBase {
  type: NewDeviceAuthentication.Password;
  value: string;
}

export interface SetupAuthInfoLocalKey extends SetupAuthInfoBase {
  type: NewDeviceAuthentication.LocalKey;
  value: {
    path: string;
    passphrase?: string;
  };
}

export interface SetupAuthInfoDevMode extends SetupAuthInfoBase {
  type: NewDeviceAuthentication.DevKey;
  value: string;
}

export type SetupAuthInfoUnion = SetupAuthInfoPassword | SetupAuthInfoLocalKey | SetupAuthInfoDevMode;

export type SetupAuthInfoFormControls = {
  type: FormControl<NewDeviceAuthentication>;
  value: FormControl<string | SetupAuthInfoLocalKey['value'] | null>;
};
