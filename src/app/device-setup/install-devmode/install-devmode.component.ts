import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SetupStep } from '../device-setup.component';

@Component({
  selector: 'app-install-devmode',
  templateUrl: './install-devmode.component.html',
  styleUrls: ['./install-devmode.component.scss']
})
export class InstallDevmodeComponent implements OnInit, SetupStep {

  canContinue: boolean = true;
  isLastStep: boolean = false;

  constructor(private router: Router, private route: ActivatedRoute) { }

  ngOnInit(): void {
  }

  async onContinue() {
    this.router.navigate(['enable-devmode'], { relativeTo: this.route.parent });
  }

}
