import {Injectable, NgZone} from "@angular/core";
import {IpcClient} from "./ipc-client";
import {Device} from "../../../../../main/types";

@Injectable({
  providedIn: 'root'
})
export class RemoteCommandService extends IpcClient {
  constructor(zone: NgZone) {
    super(zone, 'remote-command');
  }

  public async exec(device: Device, command: string): Promise<string> {
    return this.invoke('exec', {device, command});
  }

  public async read(device: Device, path: string): Promise<Uint8Array> {
    return this.invoke('read', {device, path});
  }
}
