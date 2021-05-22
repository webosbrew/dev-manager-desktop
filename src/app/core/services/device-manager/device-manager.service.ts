import { Injectable, NgZone } from "@angular/core";
import { ElectronService } from "..";

import { Resolver } from '@webosose/ares-cli/lib/base/novacom';
import { BehaviorSubject, Observable, Subject } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class DeviceManagerService {

  private resolver: Resolver;
  private subject: BehaviorSubject<Device[]>;

  constructor(electron: ElectronService, private ngZone: NgZone) {
    this.resolver = new electron.novacom.Resolver();
    this.subject = new BehaviorSubject(this.resolver.devices);
    this.load();
  }

  get devices$(): Observable<Device[]> {
    return this.subject.asObservable();
  }

  load() {
    this.resolver.load(() => {
      this.ngZone.run(() => this.subject.next(this.resolver.devices as Device[]));
    })
  }

}

export interface Device {
  name: string;
  description: string;
  host: string;
  port: number;
  indelible: boolean;
}
