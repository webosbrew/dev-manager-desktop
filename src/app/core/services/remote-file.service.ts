import {Injectable, NgZone} from "@angular/core";
import {BackendClient, BackendError} from "./backend-client";
import {Device, DeviceLike, FileItem} from "../../types";
import {Buffer} from "buffer";
import {RemoteCommandService} from "./remote-command.service";
import {defaultIfEmpty, EmptyError, firstValueFrom, ignoreElements, lastValueFrom, noop, Observable, Subject, timeout, TimeoutError} from "rxjs";
import {EventChannel} from "../event-channel";
import {map} from "rxjs/operators";
import {ProgressCallback, progressChannel} from "./progress-callback";
import {convertFileSrc} from "@tauri-apps/api/core";

/**
 * Builds a `remote-file` URL that loads `path` from `device`.
 *
 * The device name goes in the first path segment, never the host. convertFileSrc puts the scheme
 * in the host on Windows and Android (`http://remote-file.localhost/`) and in the scheme elsewhere
 * (`remote-file://localhost/`), so the host is not ours to use. Chromium also lowercases a host,
 * which a device name must survive.
 */
export function remoteFileUri(device: DeviceLike, path: string): string {
    const segments = [device.name, ...path.split('/')].filter(segment => segment.length > 0);
    return convertFileSrc('', 'remote-file') + segments.map(encodeURIComponent).join('/');
}

@Injectable({
    providedIn: 'root'
})
export class RemoteFileService extends BackendClient {

    constructor(zone: NgZone, private cmd: RemoteCommandService) {
        super(zone, 'remote-file');
    }

    public async ls(device: Device, path: string): Promise<FileItem[]> {
        return this.invoke<FileItem[]>('ls', {device, path});
    }

    public async rm(device: Device, path: string, recursive: boolean): Promise<void> {
        await this.cmd.exec(device, `xargs -0 rm ${recursive ? '-r' : ''}`, 'buffer', path);
    }

    public async read(device: DeviceLike, path: string, encoding?: 'gzip', output?: 'buffer'): Promise<Buffer>;
    public async read(device: DeviceLike, path: string, encoding?: 'gzip', output?: 'utf-8'): Promise<string>;

    public async read(device: DeviceLike, path: string, encoding?: 'gzip', output?: 'buffer' | 'utf-8'): Promise<Buffer | string> {
        const outputData = Buffer.from(await this.invoke<Buffer>('read', {device, path, encoding}));
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

    public async get(device: Device, path: string, target: string, progress?: ProgressCallback): Promise<void> {
        const onProgress = progressChannel(progress);
        await this.invoke('get', {device, path, target, onProgress});
    }

    public async put(device: Device, path: string, source: string, progress?: ProgressCallback): Promise<void> {
        const onProgress = progressChannel(progress);
        await this.invoke('put', {device, path, source, onProgress});
    }

    /**
     * Make `path` and every missing parent, the way `mkdir -p` does.
     */
    public async mkdir(device: Device, path: string, mode: number = 0o755): Promise<void> {
        await this.invoke('mkdir', {device, path, mode});
    }

    public async getTemp(device: Device, path: string, progress?: ProgressCallback): Promise<string> {
        const onProgress = progressChannel(progress);
        return await this.invoke<string>('get_temp', {device, path, onProgress});
    }

    public async serveLocal(device: Device, localPath: string): Promise<ServeInstance> {
        const subject = new Subject<Record<string, any>>();
        const token = await this.invoke<string>('serve', {device, path: localPath});
        const call = `${this.category}/serveLocal`;
        let released: Promise<void> | undefined;
        const release = () => released ??= channel.unlisten();
        const channel = new class extends EventChannel<Record<string, any>, any> {
            constructor(token: string) {
                super(token);
            }

            onClose(payload: any): void {
                console.log('serve closed', payload);
                if (payload) {
                    subject.error(BackendError.isCompatibleBody(payload) ? new BackendError(payload, call) : payload);
                } else {
                    subject.complete();
                }
                release().catch(noop);
            }

            onReceive(payload: Record<string, any>): void {
                subject.next(payload);
            }
        }(token);
        // Keep the close result even if the server stops before interrupt() is called.
        const closed = lastValueFrom(subject.pipe(ignoreElements(), defaultIfEmpty(undefined)));
        closed.catch(noop);
        let interrupted: Promise<void> | undefined;
        const interrupt = (): Promise<void> => interrupted ??= Promise.resolve().then(async () => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
                await Promise.race([
                    closed,
                    channel.closed ? closed : channel.close().then(() => closed),
                    new Promise<void>((_, reject) => {
                        timer = setTimeout(() => reject(new Error('Timed out stopping the IPK HTTP server.')), 5_000);
                    }),
                ]);
            } finally {
                clearTimeout(timer);
                subject.complete();
                release().catch(noop);
            }
        });
        // Subscribe before start: ready/error can arrive before send() resolves.
        const ready = firstValueFrom(subject.pipe(timeout({first: 60_000})));
        channel.send().catch(error => subject.error(error));
        try {
            const value = await ready;
            return {host: value['host'], requests: subject.pipe(map(v => v as ServeRequest)), interrupt};
        } catch (error) {
            await interrupt().catch(noop);
            if (error instanceof EmptyError) {
                throw new Error('IPK HTTP server closed before becoming ready.');
            }
            if (error instanceof TimeoutError) {
                throw new Error('IPK HTTP server did not become ready within 60 seconds.');
            }
            throw error;
        }
    }

}

export declare interface ServeInstance {
    host: string;
    requests: Observable<ServeRequest>;

    interrupt(): Promise<void>;
}

export declare interface ServeRequest {
    path: string;
    status: 200 | 404;
}
