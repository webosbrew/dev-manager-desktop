import {event, tauri} from '@tauri-apps/api';
import {NgZone} from '@angular/core';
import {omit} from "lodash";

export abstract class BackendClient {
  protected constructor(protected zone: NgZone, public category: string) {
  }

  protected invoke<T>(method: string, args?: Record<string, unknown>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const cmd = `plugin:${(this.category)}|${method}`;
      console.info(`invoke ${this.category}/${method}`, args);
      tauri.invoke(cmd, args)
        .then(result => {
          console.info('invoke result', result);
          return result;
        })
        .catch(reason => {
          console.warn('invoke error', reason);
          throw new BackendError(reason);
        })
        .then(result => this.zone.run(() => resolve(result as any)))
        .catch(reason => this.zone.run(() => reject(reason)));
    });
  }

  protected on(method: string, handler: (..._: any[]) => void): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    event.listen(`${this.category}/${method}`, (event) =>
      this.zone.run(() => handler(event.payload)));
  }

}

interface BackendErrorBody {
  reason: ErrorReason,
  message?: string,

  [key: string]: unknown;
}

export class BackendError extends Error {
  reason: ErrorReason;

  [key: string]: unknown;

  constructor(body: BackendErrorBody) {
    super(body.message ?? body.reason);
    this.reason = body.reason;
    Object.assign(this, omit(body, 'message', 'reason'));
  }

  static isCompatible(e: unknown): e is BackendError {
    return e instanceof Error && (typeof (e as any).reason === 'string');
  }
}

export type ErrorReason =
  'Authorization' |
  'BadPassphrase' |
  'Disconnected' |
  'ExitStatus' |
  'IO' |
  'Message' |
  'NeedsReconnect' |
  'NegativeReply' |
  'NotFound' |
  'PassphraseRequired' |
  'Timeout' |
  'Unsupported' |
  'UnsupportedKey';
