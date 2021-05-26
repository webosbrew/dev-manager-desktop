import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { SetupStep } from '../device-setup.component';

@Component({
  selector: 'app-enable-devmode',
  templateUrl: './enable-devmode.component.html',
  styleUrls: ['./enable-devmode.component.scss']
})
export class EnableDevmodeComponent implements OnInit, SetupStep {

  canContinue: boolean = true;
  isLastStep: boolean = false;

  constructor(private router: Router, private route: ActivatedRoute) { }

  ngOnInit(): void {
  }

  async onContinue() {
    this.router.navigate(['enable-keyserv'], { relativeTo: this.route.parent });
  }

}
