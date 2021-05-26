import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SetupStep } from '../device-setup.component';

@Component({
  selector: 'app-enable-keyserv',
  templateUrl: './enable-keyserv.component.html',
  styleUrls: ['./enable-keyserv.component.scss']
})
export class EnableKeyservComponent implements OnInit, SetupStep {

  canContinue: boolean = true;
  isLastStep: boolean = false;

  constructor(private router: Router, private route: ActivatedRoute) { }

  ngOnInit(): void {
  }

  async onContinue() {
    this.router.navigate(['auto-lookup'], { relativeTo: this.route.parent });
  }

}
