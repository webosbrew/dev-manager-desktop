import { Component, OnInit } from '@angular/core';
import { SetupStep } from '../device-setup.component';

@Component({
  selector: 'app-verify',
  templateUrl: './verify.component.html',
  styleUrls: ['./verify.component.scss']
})
export class VerifyComponent implements OnInit, SetupStep {

  isLastStep: boolean = true;

  constructor() { }

  ngOnInit(): void {
  }

  get canContinue(): boolean {
    return true;
  }

  onContinue() {

  }

}
