import {Injectable, NgZone} from "@angular/core";
import {BackendClient, BackendError, BackendErrorBody} from "./backend-client";
import {DeviceLike} from "../../types";
import {Buffer} from "buffer";
import {noop, ReplaySubject} from "rxjs";
import {EventChannel} from "../event-channel";

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
      return convertOutput(stdout, outputEncoding as any) as any;
    } catch (e) {
      if (BackendError.isCompatible(e)) {
        if (e.reason === 'ExitStatus') {
          throw ExecutionError.fromBackendError(e);
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
    return new CommandSubject<T>(this.zone, token, outputEncoding ?? 'buffer');
  }

}

export class CommandSubject<T = Buffer | string> extends ReplaySubject<T> {
  private channel: EventChannel<ProcData, any>;

  constructor(zone: NgZone, token: string, private encoding: 'buffer' | 'utf-8' | undefined) {
    super();
    const subject = this;
    this.channel = new class extends EventChannel<ProcData, any> {
      strbuf: string = '';

      constructor(token: string) {
        super(token);
      }

      onReceive(payload: ProcData): void {
        if (encoding == 'utf-8') {
          this.strbuf = `${this.strbuf}${Buffer.from(payload.data).toString('utf-8')}`;
          let index: number;
          while ((index = this.strbuf.indexOf('\n')) >= 0) {
            zone.run(() => subject.next(this.strbuf.substring(0, index) as any));
            this.strbuf = this.strbuf.substring(index + 1);
          }
        } else {
          zone.run(() => subject.next(Buffer.from(payload.data) as any));
        }
      }

      onClose(payload: any): void {
        console.log(this.token, 'closed', payload);
        if (!payload) {
          zone.run(() => subject.complete());
        } else if (BackendError.isCompatible(payload)) {
          const be = new BackendError(payload);
          if (be.reason === 'ExitStatus') {
            zone.run(() => subject.error(ExecutionError.fromBackendError(be)));
          } else {
            zone.run(() => subject.error(be));
          }
        } else {
          zone.run(() => subject.error(payload));
        }
      }

    }(token);
  }

  override complete() {
    super.complete();
    this.channel.unlisten().catch(noop);
  }

  override error(err: any) {
    super.error(err);
    this.channel.unlisten().catch(noop);
  }

  async write(data: string | Uint8Array): Promise<void> {
    await this.channel.send(data);
  }

  async close() {
    await this.channel.close();
  }

}

declare interface ProcData {
  index: number;
  data: number[];
}

export class ExecutionError extends Error {
  constructor(message: string, public status: number, public details: string) {
    super(message);
  }

  static isCompatible(e: unknown): e is ExecutionError {
    if (!(e instanceof Error)) {
      return false;
    }
    const p = e as Partial<ExecutionError>;
    return typeof (p.status) === 'number' && p.details !== null;
  }

  static fromBackendError(e: BackendErrorBody): ExecutionError {
    const stderr = e['stderr'] as number[];
    const data = convertOutput(stderr, 'utf-8');
    const exitCode = e['exit_code'] as number;
    return new ExecutionError(`Command exited with code ${exitCode}`, exitCode, data);
  }
}

export function escapeSingleQuoteString(value: string) {
  return value.split('\'').map(s => `'${s}'`).join('\\\'');
}

export function convertOutput(data: number[], format: 'buffer'): Buffer;
export function convertOutput(data: number[], format: 'utf-8'): string;

export function convertOutput(data: number[], format: 'buffer' | 'utf-8'): Buffer | string {
  const outputData = Buffer.from(data);
  switch (format) {
    case 'utf-8':
      return outputData.toString('utf-8');
    default:
      return outputData;
  }
}
