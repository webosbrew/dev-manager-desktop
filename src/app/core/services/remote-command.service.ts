import {Injectable, NgZone} from "@angular/core";
import {IpcClient} from "./ipc-client";
import {DeviceLike} from "../../types";
import {Buffer} from "buffer";

@Injectable({
  providedIn: 'root'
})
export class RemoteCommandService extends IpcClient {
  private encoder = new TextEncoder();

  constructor(zone: NgZone) {
    super(zone, 'remote-command');
  }

  public async exec(device: DeviceLike, command: string, output?: 'buffer', stdinData?: string | Uint8Array): Promise<Buffer>;
  public async exec(device: DeviceLike, command: string, output: 'utf-8', stdinData?: string | Uint8Array): Promise<string>;

  public async exec(device: DeviceLike, command: string, output?: 'buffer' | 'utf-8', stdinData?: string | Uint8Array):
    Promise<Buffer | string> {
    const stdin = typeof stdinData === 'string' ? [...this.encoder.encode(stdinData)] : stdinData;
    const outputData = Buffer.from(await this.invoke('exec', {device, command, stdin}));
    switch (output) {
      case 'utf-8':
        return outputData.toString('utf-8');
      default:
        return outputData;
    }
  }


}

export function escapeSingleQuoteString(value: string) {
  return value.split('\'').map(s => `'${s}'`).join('\\\'');
}
