import {Device, FileItem, FileSession} from '../../types';
import {RemoteCommandService} from './remote-command.service';
import {basename} from '@tauri-apps/api/path'
import {RemoteFileService} from "./remote-file.service";
import {ProgressCallback} from './progress-callback';
import {IOError} from "./backend-client";
import {trimEnd} from "lodash-es";

export class FileSessionImpl implements FileSession {

    private cachedHome?: string;

    constructor(private cmd: RemoteCommandService, private file: RemoteFileService, private device: Device) {
    }

    async ls(path: string): Promise<FileItem[]> {
        return this.file.ls(this.device, path).catch(e => {
            if (IOError.isCompatible(e)) {
                switch (e.code) {
                    case 'PermissionDenied':
                        throw new FileError.Denied(path, e.message);
                    case 'NotFound':
                        throw new FileError.NotFound(path, e.message);
                }
            }
            throw e;
        });
    }

    async rm(path: string, recursive: boolean): Promise<void> {
        await this.file.rm(this.device, path, recursive);
    }

    getTemp(remotePath: string, progress?: ProgressCallback): Promise<string> {
        return this.file.getTemp(this.device, remotePath, progress);
    }

    get(remotePath: string, localPath: string): Promise<void> {
        return this.file.get(this.device, remotePath, localPath);
    }

    put(localPath: string, remotePath: string, progress?: ProgressCallback): Promise<void> {
        console.log('put', localPath, '=>', remotePath);
        return this.file.put(this.device, remotePath, localPath, progress);
    }

    mkdir(path: string): Promise<void> {
        console.log('mkdir', path);
        return this.file.mkdir(this.device, path);
    }

    async uploadBatch(sources: string[], pwd: string,
                      fileCb: (name: string, index: number, total: number) => void,
                      progressCb: ProgressCallback, failCb: (name: string, e: Error) => Promise<boolean>): Promise<void> {
        for (let i = 0; i < sources.length; i++) {
            const source = sources[i];
            const name = await basename(source);
            const target = `${pwd}/${name}`;
            fileCb(name, i, sources.length);
            let retry = false;
            do {
                try {
                    await this.put(source, target, progressCb);
                } catch (e) {
                    try {
                        retry = await failCb(name, e as Error);
                    } catch (abort) {
                        throw abort;
                    }
                }
            } while (retry);
        }
    }

    async home(): Promise<string> {
        if (!this.cachedHome) {
            const def = '/media/developer';
            let path = await this.cmd.exec(this.device, 'echo -n $HOME', 'utf-8');
            this.cachedHome = trimEnd(path, ' /') || def;
        }
        return this.cachedHome;
    }

}

export namespace FileError {
    export class NotFound extends Error {
        constructor(public path: string, message: string) {
            super(message);
        }
    }

    export class Denied extends Error {
        constructor(public path: string, message: string) {
            super(message);
        }
    }
}
