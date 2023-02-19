import {Component, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {DeviceManagerService} from "../core/services";
import {Device} from "../types";
import {Subscription} from "rxjs";
import {NgbNavChangeEvent} from "@ng-bootstrap/ng-bootstrap";
import {Location} from "@angular/common";

@Component({
  selector: 'app-debug',
  templateUrl: './debug.component.html',
  styleUrls: ['./debug.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class DebugComponent implements OnInit, OnDestroy {
  device: Device | null = null;
  activeTab: string = 'crashes';

  private subscriptions: Subscription = new Subscription();

  constructor(public route: ActivatedRoute, private location: Location, private deviceManager: DeviceManagerService) {
  }

  ngOnInit(): void {
    this.subscriptions.add(this.deviceManager.selected$.subscribe((selected) => {
      this.device = selected;
    }));
    this.subscriptions.add(this.route.fragment.subscribe(frag => frag && (this.activeTab = frag)));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  tabChange($event: NgbNavChangeEvent<string>) {
    $event.preventDefault();
    const nextId = $event.nextId;
    this.activeTab = nextId;
    this.location.replaceState(`${this.location.path(false)}#${nextId}`);
  }
}
