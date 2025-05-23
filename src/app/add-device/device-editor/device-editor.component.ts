import {Component, Input, OnInit} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators} from '@angular/forms';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {DeviceManagerService} from '../../core/services';
import {MessageDialogComponent} from '../../shared/components/message-dialog/message-dialog.component';
import {KeyserverHintComponent} from '../keyserver-hint/keyserver-hint.component';
import {NewDevice, NewDeviceAuthentication, NewDeviceBase} from "../../types";
import {noop, Observable, of} from "rxjs";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {open as showOpenDialog} from '@tauri-apps/plugin-dialog';
import {BackendError} from "../../core/services/backend-client";
import {KeyPassphrasePromptComponent} from "./key-passphrase-prompt/key-passphrase-prompt.component";
import {SshPrivkeyHintComponent} from "./ssh-privkey-hint/ssh-privkey-hint.component";
import {DevmodePassphraseHintComponent} from "./devmode-passphrase-hint/devmode-passphrase-hint.component";
import {SshPasswordHintComponent} from "./ssh-password-hint/ssh-password-hint.component";
import {RetryFailedComponent} from "../retry-failed/retry-failed.component";
import {AsyncPipe} from "@angular/common";
import {SshAuthValueDirective} from "./ssh-auth-value.directive";
import * as path from '@tauri-apps/api/path';
import * as os from '@tauri-apps/plugin-os';
import {LocalFileService} from "../../core/services/local-file.service";

@Component({
    selector: 'app-device-editor',
    templateUrl: './device-editor.component.html',
    styleUrls: ['./device-editor.component.scss'],
    standalone: true,
    imports: [
        ReactiveFormsModule,
        SshAuthValueDirective,
        AsyncPipe
    ]
})
export class DeviceEditorComponent implements OnInit {

    formGroup!: FormGroup<SetupInfoFormControls>;

    @Input()
    name?: string;
    @Input()
    host?: string;
    @Input()
    port?: number;
    @Input()
    portDisabled?: boolean;
    @Input()
    username?: string;
    @Input()
    usernameDisabled?: boolean;
    @Input()
    auth?: SetupAuthInfoUnion;
    @Input()
    authDisabled?: boolean;
    @Input()
    checkName?: boolean;
    @Input()
    hideDevModeAuth?: boolean;
    @Input()
    description?: string;

    appSshPubKey$: Observable<string>;

    constructor(private modalService: NgbModal, private deviceManager: DeviceManagerService,
                private localFiles: LocalFileService) {
        this.appSshPubKey$ = fromPromise(this.deviceManager.getAppSshPubKey());
    }

    ngOnInit(): void {
        this.formGroup = new FormGroup<SetupInfoFormControls>({
            name: new FormControl<string>(this.name || '', {
                nonNullable: true,
                validators: [
                    Validators.required,
                    Validators.pattern(/^[_a-zA-Z][a-zA-Z0-9#_-]*/),
                ],
                asyncValidators: (control) => this.validateDeviceName(control.value)
            }),
            address: new FormControl<string>(this.host || '', {
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
            description: new FormControl<string>(this.description ?? '', {
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
                type: new FormControl<NewDeviceAuthentication>(this.auth?.type ?? NewDeviceAuthentication.LocalKey, {
                    nonNullable: true
                }),
                value: new FormControl<SetupAuthInfoUnion['value']>(this.auth?.value ?? null),
            }, {
                asyncValidators: (c) => this.validateAuthInfo(c.value),
            }),
        });
        if (this.usernameDisabled) {
            this.formGroup.controls.sshUsername.disable();
        }
        if (this.portDisabled) {
            this.formGroup.controls.port.disable();
        }
        if (this.authDisabled) {
            this.formGroup.controls.sshAuth.controls.type.disable();
        }
        this.formGroup.controls.sshAuth.controls.type.valueChanges.subscribe(() => {
            this.formGroup.controls.sshAuth.controls.value.reset(undefined);
        });
    }

    copyText(text: string): void {
        navigator.clipboard.writeText(text).then(noop);
    }

    async submit(): Promise<NewDevice> {
        const newDevice = await this.getNewDevice();
        try {
            console.log(newDevice);
            const info = await this.deviceManager.getDeviceInfo(newDevice);
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
        while (true) {
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
                if (retryCount >= 2) {
                    MessageDialogComponent.open(this.modalService, {
                        title: 'Failed to fetch private key',
                        message: RetryFailedComponent,
                        positive: 'OK',
                    });
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
            case NewDeviceAuthentication.AppKey: {
                return {
                    ...base,
                    privateKey: {
                        openSsh: 'id_devman',
                    }
                }
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
            .then(devices => devices.find(device => device.name === name && (!this.name || device.name !== this.name)))
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
                const keyPath = await this.deviceManager.sshKeyPath(auth.value.path);
                return this.deviceManager.verifyLocalPrivateKey(keyPath, auth.value.passphrase)
                    .then(() => null).catch(e => {
                        if (BackendError.isCompatibleBody(e)) {
                            return {[e.reason]: true};
                        }
                        console.error(e);
                        throw e;
                    });
            case NewDeviceAuthentication.AppKey:
                return this.deviceManager.getAppSshPubKey().then(() => null).catch(e => {
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
        const sshDir = await this.deviceManager.getSshKeyDir();
        let file = await showOpenDialog({
            multiple: false,
            defaultPath: sshDir,
        }).then(result => typeof (result) === 'string' && result);
        if (!file) {
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
        if (os.type() == 'android') {
            const keyInfo = await this.deviceManager.verifyLocalPrivateKey(file, passphrase);
            const newFile = await this.deviceManager.sshKeyPath(`id_file_${keyInfo.sha1.replaceAll(':', '').substring(0, 8)}`);
            console.log(keyInfo, newFile);
            await this.localFiles.copy(file, newFile).catch(e => console.error(e));
            file = newFile;
        }
        this.formGroup.controls.sshAuth.controls.value.setValue(new OpenSshLocalKeyValue(file, passphrase));
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

interface LocalKeyValue {
    path: string;
    passphrase?: string;
}

export interface SetupAuthInfoPassword extends SetupAuthInfoBase {
    type: NewDeviceAuthentication.Password;
    value: string;
}

export interface SetupAuthInfoLocalKey extends SetupAuthInfoBase {
    type: NewDeviceAuthentication.LocalKey;
    value: LocalKeyValue;
}

export interface SetupAuthInfoAppKey extends SetupAuthInfoBase {
    type: NewDeviceAuthentication.AppKey;
    value: null;
}

export interface SetupAuthInfoDevMode extends SetupAuthInfoBase {
    type: NewDeviceAuthentication.DevKey;
    value: string;
}

export type SetupAuthInfoUnion =
    SetupAuthInfoPassword
    | SetupAuthInfoLocalKey
    | SetupAuthInfoAppKey
    | SetupAuthInfoDevMode;

export type SetupAuthInfoFormControls = {
    type: FormControl<NewDeviceAuthentication>;
    value: FormControl<SetupAuthInfoUnion['value']>;
};

export class OpenSshLocalKeyValue implements LocalKeyValue {
    path: string;
    passphrase?: string;

    constructor(path: string, passphrase?: string) {
        this.path = path;
        this.passphrase = passphrase
    }

    toString(): string {
        const sep = path.sep();
        let sepIndex = this.path.lastIndexOf(sep);
        return this.path.substring(sepIndex + 1);
    }
}
