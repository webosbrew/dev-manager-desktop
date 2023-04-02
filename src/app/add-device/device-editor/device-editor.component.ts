import {Component, Input, OnInit} from '@angular/core';
import {AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, Validators} from '@angular/forms';
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

  formGroup!: UntypedFormGroup;

  @Input()
  port?: number;
  @Input()
  username?: string;
  @Input()
  auth?: NewDeviceAuthentication;

  constructor(
    private modalService: NgbModal,
    private deviceManager: DeviceManagerService,
    private fb: UntypedFormBuilder,
  ) {
  }

  ngOnInit(): void {
    this.formGroup = this.fb.group({
      name: ['tv', Validators.pattern(/^[_a-zA-Z][a-zA-Z0-9#_-]*/)],
      address: ['', Validators.pattern(/^(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))$/)],
      port: [this.port ?? 9922, [Validators.min(0), Validators.max(65535)]],
      description: [undefined],
      // Unix username Regex: https://unix.stackexchange.com/a/435120/277731
      sshUsername: [this.username ?? 'prisoner', Validators.pattern(/^[a-z_]([a-z0-9_-]{0,31}|[a-z0-9_-]{0,30}\$)$/)],
      sshAuth: [this.auth ?? 'devKey'],
      sshPassword: [''],
      sshPrivateKey: ['', [], [(c: AbstractControl) => this.validatePrivateKeyName(c)]],
      sshPrivateKeyPassphrase: ['', [], [(c: AbstractControl) => this.validatePrivateKeyPassphrase(c)]],
    });
    const sshPrivateKey = this.formGroup.get('sshPrivateKey')!;
    const sshPrivateKeyPassphrase = this.formGroup.get('sshPrivateKeyPassphrase')!;
    sshPrivateKey.valueChanges.subscribe(() => sshPrivateKeyPassphrase.markAsDirty());
    sshPrivateKeyPassphrase.valueChanges.subscribe(() => sshPrivateKey.markAsDirty());
  }

  get sshAuth(): NewDeviceAuthentication | null {
    return this.formGroup.get('sshAuth')!.value;
  }

  get setupInfo(): SetupInfo {
    return this.formGroup.value as SetupInfo;
  }

  async submit(): Promise<NewDevice> {
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
    return newDevice;
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
            openSshData: await this.fetchPrivKey(value.address, value.sshPrivateKeyPassphrase!),
          }, passphrase: value.sshPrivateKeyPassphrase!
        };
      }
      case 'localKey': {
        return {
          ...base, privateKey: {
            openSsh: value.sshPrivateKey!,
          }, passphrase: value.sshPrivateKeyPassphrase
        };
      }
    }
  }

  private validatePrivateKeyName(control: AbstractControl): Observable<null | ValidationErrors> {
    const name: string = control.value;
    if (!name) {
      return of(null);
    }
    const passphrase = (control.parent?.value as SetupInfo)?.sshPrivateKeyPassphrase || undefined;
    return fromPromise(this.deviceManager.verifyLocalPrivateKey(name, passphrase)
      .then(() => null).catch(e => {
        switch (e.reason) {
          case 'PassphraseRequired':
          case 'BadPassphrase':
          case 'UnsupportedKey':
          case 'IO':
            return {[e.reason]: true};
        }
        console.log(e);
        return null;
      }));
  }

  private validatePrivateKeyPassphrase(control: AbstractControl): Observable<null | ValidationErrors> {
    const name = (control.parent?.value as SetupInfo)?.sshPrivateKey || undefined;
    if (!name) {
      return of(null);
    }
    const passphrase: string = control.value;
    return fromPromise(this.deviceManager.verifyLocalPrivateKey(name, passphrase)
      .then(() => null).catch(e => {
        switch (e.reason) {
          case 'BadPassphrase':
            return {[e.reason]: true};
        }
        return null;
      }));
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
  sshPrivateKey?: string;
  sshPrivateKeyPassphrase?: string;
}
