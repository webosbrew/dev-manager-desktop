import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { SetupStep } from '../device-setup.component';

@Component({
  selector: 'app-auto-lookup',
  templateUrl: './auto-lookup.component.html',
  styleUrls: ['./auto-lookup.component.scss']
})
export class AutoLookupComponent implements OnInit, SetupStep {

  canContinue: boolean = true;
  isLastStep: boolean = false;

  constructor(private router: Router, private route: ActivatedRoute) { }

  ngOnInit(): void {
  }

  async onContinue() {
    this.router.navigate(['info'], { relativeTo: this.route.parent });
  }

}
