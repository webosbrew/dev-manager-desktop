import {Injectable, NgZone} from '@angular/core';
import {BackendClient} from "./backend-client";
import {Device} from "../../types";

@Injectable({
  providedIn: 'root'
})
export class DevModeService extends BackendClient {

  constructor(zone: NgZone) {
    super(zone, "dev-mode");
  }

  async status(device: Device): Promise<DevModeStatus> {
    return this.invoke('status', {device});
  }

  async token(device: Device): Promise<string> {
    return this.invoke('token', {device});
  }
}

export interface DevModeStatus {
  token?: string;
  remaining?: string;
}
