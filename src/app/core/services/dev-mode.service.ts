import {Injectable, NgZone} from '@angular/core';
import {IpcClient} from "./ipc-client";

@Injectable({
  providedIn: 'root'
})
export class DevModeService extends IpcClient {

  constructor(zone: NgZone) {
    super(zone, "dev-mode");
  }

  async checkDevMode(sessionToken: string): Promise<DevModeResponse> {
    return this.invoke<string>('check', {sessionToken}).then(json => JSON.parse(json));
  }
}

export interface DevModeResponse {
  result: string;
  errorCode: string;
  errorMsg: string;
}
