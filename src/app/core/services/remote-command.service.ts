import {Injectable, NgZone} from "@angular/core";
import {IpcClient} from "./ipc-client";
import {DeviceLike} from "../../types";
import {Buffer} from "buffer";
import {listen, emit, UnlistenFn} from '@tauri-apps/api/event';
import {ReplaySubject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class RemoteCommandService extends IpcClient {
  private encoder = new TextEncoder();

  constructor(zone: NgZone) {
    super(zone, 'remote-command');
  }

  public async exec(device: DeviceLike, command: string, outputEncoding?: 'buffer', stdinData?: string | Uint8Array): Promise<Buffer>;
  public async exec(device: DeviceLike, command: string, outputEncoding: 'utf-8', stdinData?: string | Uint8Array): Promise<string>;

  public async exec<T = Buffer | string>(device: DeviceLike, command: string, outputEncoding?: 'buffer' | 'utf-8', stdinData?: string | Uint8Array):
    Promise<T> {
    const stdin = typeof stdinData === 'string' ? [...this.encoder.encode(stdinData)] : stdinData;
    try {
      const stdout: number[] = await this.invoke('exec', {device, command, stdin});
      return this.convertOutput(stdout, outputEncoding) as any;
    } catch (e: IpcErrors.ExitStatus | any) {
      if (e.exit_code && e.stderr) {
        throw new ExecutionError(e.stderr, e.exit_code, this.convertOutput(e.stderr, outputEncoding));
      }
      throw e;
    }
  }

  public async popen(device: DeviceLike, command: string, outputEncoding?: 'buffer'): Promise<CommandSubject<Buffer>>;
  public async popen(device: DeviceLike, command: string, outputEncoding: 'utf-8'): Promise<CommandSubject<string>>;

  public async popen<T = Buffer | string>(device: DeviceLike, command: string, outputEncoding?: 'buffer' | 'utf-8'):
    Promise<CommandSubject<T>> {
    const token: string = await this.invoke('spawn', {device, command});
    return await CommandSubject.fromId(token, outputEncoding ?? 'buffer');
  }

  private convertOutput(data: number[], format?: 'buffer' | 'utf-8'): Buffer | string {
    const outputData = Buffer.from(data);
    switch (format) {
      case 'utf-8':
        return outputData.toString('utf-8');
      default:
        return outputData;
    }
  }

}

export class CommandSubject<T = Buffer | string> extends ReplaySubject<T> {
  private readonly encoder = new TextEncoder();
  protected unlisten?: UnlistenFn;

  private constructor(private id: string, private encoding: 'buffer' | 'utf-8' | undefined) {
    super();
  }

  override complete() {
    super.complete();
    this.unlisten?.();
    delete this.unlisten;
  }

  override error(err: any) {
    super.error(err);
    this.unlisten?.();
    delete this.unlisten;
  }

  async write(data: string | Uint8Array): Promise<void> {
  }

  async close() {
    await emit(`cmd-interrupt-${this.id}`);
  }


  static async fromId<T = Buffer | string>(id: string, outputEncoding: 'buffer' | 'utf-8'): Promise<CommandSubject<T>> {
    const subject = new CommandSubject<T>(id, outputEncoding);
    let strbuf: string = '';
    subject.unlisten = await listen(`cmd-read-${id}`, (event) => {
      const payload = event.payload as ProcData;
      if (outputEncoding == 'utf-8') {
        strbuf = `${strbuf}${Buffer.from(payload.data).toString('utf-8')}`;
        let index: number;
        while ((index = strbuf.indexOf('\n')) >= 0) {
          subject.next(strbuf.substring(0, index) as any);
          strbuf = strbuf.substring(index + 1);
        }
      } else {
        subject.next(Buffer.from(payload.data) as any);
      }
    });
    return subject;
  }
}

declare interface ProcData {
  index: number;
  data: number[];
}

export class ExecutionError<T = Buffer | string> extends Error {
  constructor(message: string, public status: number, public data: T) {
    super(message);
  }
}

namespace IpcErrors {
  export interface ExitStatus {
    exit_code: number;
    stderr: number;
  }
}

export function escapeSingleQuoteString(value: string) {
  return value.split('\'').map(s => `'${s}'`).join('\\\'');
}
