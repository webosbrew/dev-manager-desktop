import {invoke} from '@tauri-apps/api/tauri';
import {Event, listen} from "@tauri-apps/api/event";
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
            const call = `${this.category}/${method}`;
            console.debug('invoke', call, args);
            invoke(cmd, args)
                .then((result: unknown) => {
                    console.debug('invoke', call, 'result', typeof result, result);
                    this.zone.run(() => resolve(result as any));
                })
                .catch((reason: unknown) => {
                    console.warn('invoke', call, 'error', typeof reason, reason);
                    this.zone.run(() => {
                        if (typeof reason === 'string' && reason.startsWith('{')) {
                            try {
                                reason = JSON.parse(reason);
                            } catch (e) {
                                reason = new Error(reason as string);
                            }
                        }
                        reject(BackendClient.toBackendError(reason, call));
                    });
                });
        });
    }

    protected on(method: string, handler: (..._: any[]) => void): void {
        listen(`${this.category}/${method}`, (event: Event<any>) =>
            this.zone.run(() => handler(event.payload))).then(noop);
    }

    private static toBackendError(e: unknown, call: string): Error {
        if (BackendError.isCompatibleBody(e)) {
            if (e.reason === 'ExitStatus') {
                return ExecutionError.fromBackendError(e);
            } else if (IOError.isCompatibleBody(e)) {
                return new IOError(e, call);
            }
            return new BackendError(e, call);
        }
        return e as Error;
    }

}

export interface BackendErrorBody {
    reason: ErrorReason,
    message?: string,
    unhandled?: boolean,

    [key: string]: unknown;
}

export interface IOErrorBody extends BackendErrorBody {
    code: 'PermissionDenied' | 'NotFound' | string;
}

export class BackendError extends Error {
    reason: ErrorReason;

    [key: string]: unknown;

    constructor(body: BackendErrorBody, public call: string) {
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
