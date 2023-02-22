import {Device, FileItem, FileSession} from '../../types';
import {RemoteCommandService} from './remote-command.service';
import * as path from 'path';
import {basename} from '@tauri-apps/api/path'
import {RemoteFileService} from "./remote-file.service";
import {IOError} from "./backend-client";

export class FileSessionImpl implements FileSession {
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

  getTemp(remotePath: string): Promise<string> {
    return this.file.getTemp(this.device, remotePath);
  }

  get(remotePath: string, localPath: string): Promise<void> {
    return this.file.get(this.device, remotePath, localPath);
  }

  put(localPath: string, remotePath: string): Promise<void> {
    console.log('put', localPath, '=>', remotePath);
    return this.file.put(this.device, remotePath, localPath);
  }

  async uploadBatch(sources: string[], pwd: string, failCb: (name: string, e: Error) => Promise<boolean>): Promise<void> {
    for (const source of sources) {
      const name = await basename(source);
      const target = path.join(pwd, name);
      let retry = false;
      do {
        try {
          await this.put(source, target);
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
