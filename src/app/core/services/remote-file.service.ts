import {Injectable, NgZone} from "@angular/core";
import {BackendClient} from "./backend-client";
import {Device, FileItem} from "../../types";
import {Buffer} from "buffer";
import {RemoteCommandService} from "./remote-command.service";

@Injectable({
  providedIn: 'root'
})
export class RemoteFileService extends BackendClient {

  constructor(zone: NgZone, private cmd: RemoteCommandService) {
    super(zone, 'remote-file');
  }

  public async ls(device: Device, path: string): Promise<FileItem[]> {
    return this.invoke('ls', {device, path});
  }

  public async rm(device: Device, path: string, recursive: boolean): Promise<void> {
    await this.cmd.exec(device, `xargs -0 rm ${recursive ? '-r' : ''}`, 'buffer', path);
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
