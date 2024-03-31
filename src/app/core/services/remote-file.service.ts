import {Injectable, NgZone} from "@angular/core";
import {BackendClient, BackendError} from "./backend-client";
import {Device, DeviceLike, FileItem} from "../../types";
import {Buffer} from "buffer";
import {RemoteCommandService} from "./remote-command.service";
import {finalize, firstValueFrom, lastValueFrom, Observable, Subject} from "rxjs";
import {EventChannel} from "../event-channel";
import {map} from "rxjs/operators";

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

    public async get(device: Device, path: string, target: string): Promise<void> {
        await this.invoke('get', {device, path, target});
    }

    public async put(device: Device, path: string, source: string): Promise<void> {
        await this.invoke('put', {device, path, source});
    }

    public async mkdir(device: Device, path: string): Promise<void> {
        await this.cmd.exec(device, `xargs -0 mkdir`, 'buffer', path);
    }

    public async getTemp(device: Device, path: string): Promise<string> {
        return await this.invoke<string>('get_temp', {device, path});
    }

    public async serveLocal(device: Device, localPath: string): Promise<ServeInstance> {
        const subject = new Subject<Record<string, any>>();
        const token = await this.invoke<string>('serve', {device, path: localPath});
        const call = `${this.category}/serveLocal`;
        const channel = new class extends EventChannel<Record<string, any>, any> {
            constructor(token: string) {
                super(token);
            }

            onClose(payload: any): void {
                console.log('serve closed', payload);
                if (payload) {
                    if (BackendError.isCompatibleBody(payload)) {
                        subject.error(new BackendError(payload, call));
                    } else {
                        subject.error(payload);
                    }
                } else {
                    subject.complete();
                }
            }

            onReceive(payload: Record<string, any>): void {
                subject.next(payload);
            }
        }(token);
        await channel.send();
        return firstValueFrom(subject).then((v: Record<string, any>): ServeInstance => {
            return {
                host: v['host'],
                requests: subject.pipe(map(v => v as ServeRequest), finalize(() => channel.unlisten())),
                async interrupt(): Promise<void> {
                    await channel.close();
                    await lastValueFrom(subject).catch(e => {
                        if (e.name === 'EmptyError') {
                            return null;
                        } else {
                            throw e
                        }
                    });
                },
            }
        }).catch(e => {
            channel.unlisten();
            throw e;
        });
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
