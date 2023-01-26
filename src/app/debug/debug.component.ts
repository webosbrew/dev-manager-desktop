import {Component, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import {DeviceManagerService} from "../core/services";
import {Device} from "../types";
import {Subscription} from "rxjs";

@Component({
  selector: 'app-debug',
  templateUrl: './debug.component.html',
  styleUrls: ['./debug.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class DebugComponent implements OnInit, OnDestroy {
  device: Device | null = null;

  private subscription?: Subscription;

  constructor(public route: ActivatedRoute, private deviceManager: DeviceManagerService) {
  }

  ngOnInit(): void {
    this.subscription = this.deviceManager.selected$.subscribe((selected) => {
      this.device = selected;
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
