import {Component, Input, OnInit} from '@angular/core';
import {FormControl, FormGroup, ValidationErrors, Validators} from '@angular/forms';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {DeviceManagerService} from '../../core/services';
import {MessageDialogComponent} from '../../shared/components/message-dialog/message-dialog.component';
import {KeyserverHintComponent} from '../keyserver-hint/keyserver-hint.component';
import {NewDevice, NewDeviceAuthentication, NewDeviceBase} from "../../types";
import {Observable, of} from "rxjs";
import {fromPromise} from "rxjs/internal/observable/innerFrom";

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
      port: new FormControl<number>(this.port ?? 9922, {
        nonNullable: true,
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
      sshUsername: new FormControl<string>(this.username ?? 'prisoner', {
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
        value: new FormControl<string | SetupAuthInfoLocalKey['value'] | null>(''),
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
  }

  async submit(): Promise<NewDevice> {
    const newDevice = await this.getNewDevice();
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
    return newDevice;
  }

  private async fetchPrivateKey(address: string, passphrase?: string): Promise<string> {
    let retryCount = 0;
    while (retryCount < 3) {
      try {
        return await this.deviceManager.novacomGetKey(address, passphrase);
      } catch (e) {
        const confirm = MessageDialogComponent.open(this.modalService, {
          title: 'Failed to fetch private key',
          message: KeyserverHintComponent,
          error: e as Error,
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
    return await ref.result;
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
      port: value.port,
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
            openSsh: value.sshAuth.value.name,
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

  private validateAuthInfo(auth: SetupAuthInfoUnion): Observable<null | ValidationErrors> {
    switch (auth.type) {
      case NewDeviceAuthentication.Password:
        return of(auth.value ? null : {PasswordRequired: true});
      case NewDeviceAuthentication.LocalKey:
        if (!auth.value) {
          return of({PrivKeyRequired: true});
        }
        return fromPromise(this.deviceManager.verifyLocalPrivateKey(auth.value.name, auth.value.passphrase)
          .then(() => null).catch(e => {
            switch (e.reason) {
              case 'PassphraseRequired':
              case 'BadPassphrase':
              case 'UnsupportedKey':
              case 'IO':
                return {[e.reason]: true};
            }
            return null;
          }));
      case NewDeviceAuthentication.DevKey:
        return of(auth.value ? null : {PassphraseRequired: true});

    }
  }
}

interface SetupInfo {
  name: string;
  address: string;
  port: number;
  description: string;
  sshUsername: string;
  sshAuth: SetupAuthInfoUnion;
}


type SetupInfoFormControls = {
  name: FormControl<string>;
  address: FormControl<string>;
  port: FormControl<number>;
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
    name: string;
    passphrase: string;
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
