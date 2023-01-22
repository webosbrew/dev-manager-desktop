import {Injectable, NgZone} from "@angular/core";
import {IpcClient} from "./ipc-client";
import {Device} from "../../../../main/types";
import {isArrayLike, isString} from "lodash";

@Injectable({
  providedIn: 'root'
})
export class RemoteCommandService extends IpcClient {

  constructor(zone: NgZone) {
    super(zone, 'remote-command');
  }

  public async exec(device: Device, command: string, stdinData?: string | Uint8Array): Promise<Uint8Array> {
    const stdin = typeof stdinData === 'string' ? [...new TextEncoder().encode(stdinData)] : stdinData;
    return new Uint8Array(await this.invoke('exec', {device, command, stdin}));
  }

  public async read(device: Device, path: string): Promise<Uint8Array> {
    return new Uint8Array(await this.invoke('read', {device, path}));
  }

  public async write(device: Device, path: string, content?: string | Uint8Array): Promise<void> {
    await this.invoke('write', {device, path, content});
  }

  public async get(device: Device, path: string, target: string): Promise<void> {
    await this.invoke('get', {device, path, target});
  }

  public async put(device: Device, path: string, source: string): Promise<void> {
    await this.invoke('put', {device, path, source});
  }

  public async getTemp(device: Device, path: string): Promise<string> {
    return await this.invoke('get_temp', {device, path});
  }

}
