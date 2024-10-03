import {Injectable, NgZone} from "@angular/core";
import {BackendClient, BackendError, BackendErrorBody} from "./backend-client";
import {DeviceLike} from "../../types";
import {Buffer} from "buffer";
import {noop, ReplaySubject} from "rxjs";
import {EventChannel} from "../event-channel";
import {isNil} from "lodash-es";

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
            const encoding = RemoteCommandService.byteStringEncoding(outputEncoding);
            return await this.invoke('exec', {device, command, stdin, encoding});
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
        return new CommandSubject<T>(this.zone, token, command, outputEncoding ?? 'buffer');
    }

    private static byteStringEncoding(encoding?: 'buffer' | 'utf-8') {
        switch (encoding) {
            case 'utf-8':
                return 'string';
            default:
                return 'binary';
        }
    }

}

export declare class CommandData<T = Buffer | string> {
    fd: number;
    data: T;
}

export class CommandSubject<T = Buffer | string> extends ReplaySubject<CommandData<T>> {
    private channel: EventChannel<ProcData, SpawnResult>;

    constructor(zone: NgZone, token: string, command: string, encoding: 'buffer' | 'utf-8' | undefined) {
        super();
        const subject = this;
        this.channel = new class extends EventChannel<ProcData, SpawnResult> {
            stdout: string = '';
            stderr: string = '';
            interrupted = false;

            constructor(token: string) {
                super(token);
            }

            onReceive(payload: ProcData): void {
                if (payload.fd !== 0) {
                    this.stderr += Buffer.from(payload.data).toString('utf-8');
                    return;
                }
                if (encoding == 'utf-8') {
                    this.stdout = `${this.stdout}${Buffer.from(payload.data).toString('utf-8')}`;
                    let index: number;
                    while ((index = this.stdout.indexOf('\n')) >= 0) {
                        zone.run(() => subject.next({
                            fd: payload.fd,
                            data: this.stdout.substring(0, index) as any,
                        }));
                        this.stdout = this.stdout.substring(index + 1);
                    }
                } else {
                    zone.run(() => subject.next({
                        fd: payload.fd,
                        data: Buffer.from(payload.data) as any,
                    }));
                }
            }

            onClose(payload: SpawnResult): void {
                console.log(this.token, 'closed', payload);
                if (!payload) {
                    zone.run(() => subject.complete());
                } else if (payload.type === 'Exit') {
                    if (payload.status === 0) {
                        zone.run(() => subject.complete());
                    } else {
                        zone.run(() => subject.error(new ExecutionError(`Process exited with status ${payload.status}`,
                            payload.status, this.stderr, command)));
                    }
                } else if (payload.type === 'Signal') {
                    // Treat user initiated SIGINT as success
                    if (this.interrupted && payload.signal === "INT") {
                        zone.run(() => subject.complete());
                    } else {
                        zone.run(() => subject.error(new ExecutionError(`Process exited with signal ${payload.signal}`,
                            -1, this.stderr, command)));
                    }
                } else {
                    zone.run(() => subject.error(new Error('Process closed')));
                }
            }

            override async send<P>(payload?: P): Promise<void> {
                if (isNil(payload)) {
                    this.interrupted = true;
                }
                return super.send(payload);
            }

        }(token);
        // After creation, notify the process to start
        this.channel.send().catch(noop);
    }

    override complete() {
        super.complete();
        this.channel.unlisten().catch(noop);
    }

    override error(err: any) {
        super.error(err);
        this.channel.unlisten().catch(noop);
    }

    async write(data?: Uint8Array): Promise<void> {
        await this.channel.send({data});
    }

}

declare interface ProcData {
    fd: number;
    data: number[];
}

declare interface SpawnExited {
    type: 'Exit';
    status: number;
}

declare interface SpawnSignaled {
    type: 'Signal';
    signal?: string;
    coreDumped: boolean;
}

declare interface SpawnClosed {
    type: 'Closed';
}

type SpawnResult = SpawnExited | SpawnSignaled | SpawnClosed;

export class ExecutionError extends Error {
    constructor(message: string, public status: number, public details: string, public command: string) {
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
        const command = e['command'] as string;
        return new ExecutionError(`Command \`${command}\` exited with code ${exitCode}`, exitCode, data, command);
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
