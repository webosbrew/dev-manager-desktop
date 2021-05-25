import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Event, NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
@Component({
  selector: 'app-device-setup',
  templateUrl: './device-setup.component.html',
  styleUrls: ['./device-setup.component.scss']
})
export class DeviceSetupComponent implements OnInit, OnDestroy {

  urlStack: string[];
  currentStep?: SetupStep;
  subscription: Subscription;

  constructor(private router: Router, private location: Location) {
    this.urlStack = [];
    this.subscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: Event) => {
        this.urlStack.push((event as NavigationEnd).url);
      });
  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  closeSetup() {
    this.router.navigate(['..']);
  }

  stepBack() {
    let url = this.urlStack.pop() && this.urlStack.pop();
    if (!url) return;
    this.router.navigateByUrl(url);
  }

  stepNext() {
    this.currentStep?.onContinue();
  }

  onStepChanged(component: SetupStep) {
    this.currentStep = component;
  }
}

export interface SetupStep {
  onContinue(): Promise<void>
  readonly canContinue: boolean;
  readonly isLastStep: boolean;
}
