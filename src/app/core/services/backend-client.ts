import {event} from '@tauri-apps/api';
import {invoke} from '@tauri-apps/api/tauri';
import {NgZone} from '@angular/core';
import {omit} from "lodash-es";
import {noop} from "rxjs";
import {ExecutionError} from "./remote-command.service";

export abstract class BackendClient {
    protected constructor(protected zone: NgZone, public category: string) {
    }

    protected invoke<T>(method: string, args?: Record<string, unknown>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const cmd = `plugin:${(this.category)}|${method}`;
            console.debug('invoke', `${this.category}/${method}`, args);
            invoke(cmd, args)
                .then(result => {
                    console.debug('invoke', `${this.category}/${method}`, 'result', result);
                    this.zone.run(() => resolve(result as any));
                })
                .catch(reason => {
                    console.warn('invoke', `${this.category}/${method}`, 'error', reason);
                    this.zone.run(() => reject(BackendClient.toBackendError(reason)));
                });
        });
    }

    protected on(method: string, handler: (..._: any[]) => void): void {
        event.listen(`${this.category}/${method}`, (event) =>
            this.zone.run(() => handler(event.payload))).then(noop);
    }

    private static toBackendError(e: unknown): Error {
        if (BackendError.isCompatibleBody(e)) {
            if (e.reason === 'ExitStatus') {
                return ExecutionError.fromBackendError(e);
            } else if (IOError.isCompatibleBody(e)) {
                return new IOError(e);
            }
            return new BackendError(e);
        }
        return e as Error;
    }

}

export interface BackendErrorBody {
    reason: ErrorReason,
    message?: string,

    [key: string]: unknown;
}

export interface IOErrorBody extends BackendErrorBody {
    code: 'PermissionDenied' | 'NotFound' | string;
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
        return e instanceof Error && BackendError.isCompatibleBody(e);
    }

    static isCompatibleBody(e: unknown): e is BackendErrorBody {
        return (typeof (e as any).reason === 'string');
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

export class IOError extends BackendError {
    declare code: 'PermissionDenied' | 'NotFound' | string;

    static override isCompatible(e: unknown): e is IOError {
        return BackendError.isCompatible(e) && e.reason === 'IO';
    }

    static override isCompatibleBody(e: unknown): e is IOErrorBody {
        return BackendError.isCompatibleBody(e) && e.reason === 'IO';
    }
}
