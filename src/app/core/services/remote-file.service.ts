import {Injectable, NgZone} from "@angular/core";
import {IpcClient} from "./ipc-client";
import {Device, FileItem} from "../../../../main/types";
import {Buffer} from "buffer";

@Injectable({
  providedIn: 'root'
})
export class RemoteFileService extends IpcClient {

  constructor(zone: NgZone) {
    super(zone, 'remote-file');
  }

  public async ls(device: Device, path: string): Promise<FileItem[]> {
    return this.invoke('ls', {device, path});
  }

  public async read(device: Device, path: string, output?: 'buffer'): Promise<Buffer>;
  public async read(device: Device, path: string, output: 'utf-8'): Promise<string>;

  public async read(device: Device, path: string, output?: 'buffer' | 'utf-8'): Promise<Buffer | string> {
    const outputData = Buffer.from(await this.invoke('read', {device, path}));
    switch (output) {
      case 'utf-8':
        return outputData.toString('utf-8');
      default:
        return outputData;
    }
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
