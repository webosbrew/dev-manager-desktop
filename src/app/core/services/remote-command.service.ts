import {Injectable, NgZone} from "@angular/core";
import {BackendClient, BackendError} from "./backend-client";
import {DeviceLike} from "../../types";
import {Buffer} from "buffer";
import {listen, emit, UnlistenFn} from '@tauri-apps/api/event';
import {ReplaySubject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class RemoteCommandService extends BackendClient {
  private encoder = new TextEncoder();

  constructor(zone: NgZone) {
    super(zone, 'remote-command');
  }

  /**
   *
   * @param device Device to invoke command
   * @param command Command to execute
   * @param outputEncoding
   * @param stdinData
   * @throws ExecutionError If the command doesn't exit with status 0
   */
  public async exec(device: DeviceLike, command: string, outputEncoding?: 'buffer', stdinData?: string | Uint8Array): Promise<Buffer>;
  /**
   *
   * @param device Device to invoke command
   * @param command Command to execute
   * @param outputEncoding
   * @param stdinData
   * @throws ExecutionError If the command doesn't exit with status 0
   */
  public async exec(device: DeviceLike, command: string, outputEncoding: 'utf-8', stdinData?: string | Uint8Array): Promise<string>;

  public async exec<T = Buffer | string>(device: DeviceLike, command: string, outputEncoding?: 'buffer' | 'utf-8', stdinData?: string | Uint8Array):
    Promise<T> {
    const stdin = typeof stdinData === 'string' ? [...this.encoder.encode(stdinData)] : stdinData;
    try {
      const stdout: number[] = await this.invoke('exec', {device, command, stdin});
      return convertOutput(stdout, outputEncoding) as any;
    } catch (e) {
      if (e instanceof BackendError) {
        if (e.reason === 'ExitStatus') {
          const stderr = e['stderr'] as number[];
          throw new ExecutionError(e.message, e['exit_code'] as number, convertOutput(stderr, outputEncoding));
        }
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

}

export class CommandSubject<T = Buffer | string> extends ReplaySubject<T> {
  private readonly encoder = new TextEncoder();
  protected unlisten: UnlistenFn[] = [];

  private constructor(private id: string, private encoding: 'buffer' | 'utf-8' | undefined) {
    super();
  }

  override complete() {
    super.complete();
    this.unlisten.forEach(fn => fn());
    this.unlisten = [];
  }

  override error(err: any) {
    super.error(err);
    this.unlisten.forEach(fn => fn());
    this.unlisten = [];
  }

  async write(data: string | Uint8Array): Promise<void> {
  }

  async close() {
    await emit(`cmd-interrupt-${this.id}`);
  }


  static async fromId<T = Buffer | string>(id: string, outputEncoding: 'buffer' | 'utf-8'): Promise<CommandSubject<T>> {
    const subject = new CommandSubject<T>(id, outputEncoding);
    let strbuf: string = '';
    subject.unlisten.push(await listen(`cmd-read-${id}`, (event) => {
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
    }));
    subject.unlisten.push(await listen(`cmd-error-${id}`, (event) => {
      if (BackendError.isCompatible(event.payload)) {
        const be = new BackendError(event.payload);
        if (be.reason === 'ExitStatus') {
          const stderr = be['stderr'] as number[];
          subject.error(new ExecutionError(be.message, be['exit_code'] as number, convertOutput(stderr, outputEncoding)));
        } else {
          subject.error(be);
        }
      } else {
        subject.error(event.payload);
      }
    }));
    subject.unlisten.push(await listen(`cmd-finish-${id}`, (event) => {
      subject.complete();
    }));
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

export interface ExitStatusError {
  reason: 'ExitStatus';
  exit_code: number;
  stderr: number;
}

namespace IpcErrors {
}

export function escapeSingleQuoteString(value: string) {
  return value.split('\'').map(s => `'${s}'`).join('\\\'');
}

function convertOutput(data: number[], format?: 'buffer' | 'utf-8'): Buffer | string {
  const outputData = Buffer.from(data);
  switch (format) {
    case 'utf-8':
      return outputData.toString('utf-8');
    default:
      return outputData;
  }
}
