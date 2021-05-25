import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Route, Router } from '@angular/router';
import { DeviceEditSpec, DeviceManagerService } from '../../core/services/device-manager/device-manager.service';
import { SetupStep } from '../device-setup.component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
@Component({
  selector: 'app-info',
  templateUrl: './info.component.html',
  styleUrls: ['./info.component.scss']
})
export class InfoComponent implements OnInit, SetupStep {

  formGroup: FormGroup;

  isLastStep: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private deviceManager: DeviceManagerService,
    fb: FormBuilder,
  ) {
    this.formGroup = fb.group({
      name: ['test', Validators.required],
      address: ['127.0.0.1', Validators.required],
      port: ['22', Validators.required],
      description: [],
      sshUsername: ['root', Validators.required],
      sshAuth: ['password', Validators.required],
      sshPassword: ['1'],
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

  onContinue() {
    this.deviceManager.addDevice(this.createDeviceSpec()).then(value => {
      console.log(value);
      // this.router.navigate(['verify'], { relativeTo: this.route.parent });
    })
  }

  createDeviceSpec(): DeviceEditSpec {
    let value = this.formGroup.value as SetupInfo;
    return {
      name: value.name,
      port: value.port,
      host: value.address,
      username: value.sshUsername,
      profile: 'ose',
    };
  }
}

class SetupInfo {
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
