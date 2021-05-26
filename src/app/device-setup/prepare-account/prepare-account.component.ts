import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SetupStep } from '../device-setup.component';

@Component({
  selector: 'app-prepare-account',
  templateUrl: './prepare-account.component.html',
  styleUrls: ['./prepare-account.component.scss']
})
export class PrepareAccountComponent implements OnInit, SetupStep {

  canContinue: boolean = true;
  isLastStep: boolean = false;

  constructor(private router: Router, private route: ActivatedRoute) { }

  ngOnInit(): void {
  }

  async onContinue() {
    this.router.navigate(['install-devmode'], { relativeTo: this.route.parent });
  }

}
