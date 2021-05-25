import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DeviceManagerService } from '../../core/services/device-manager/device-manager.service';
import { SetupStep } from '../device-setup.component';

@Component({
  selector: 'app-verify',
  templateUrl: './verify.component.html',
  styleUrls: ['./verify.component.scss']
})
export class VerifyComponent implements OnInit, SetupStep {

  isLastStep: boolean = true;

  constructor(
    private deviceManager: DeviceManagerService,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    let device = this.route.snapshot.queryParamMap.get('device');
    this.deviceManager.deviceInfo(device).then(info => {
      console.log(info);
    });
  }

  get canContinue(): boolean {
    return true;
  }

  async onContinue() {

  }

}
