import {IpcClient} from "./ipc-client";
import {Attributes, FileEntry, FileItem, FileSession} from "../../../../main/types";
import {basename} from "@tauri-apps/api/path";
import {NgZone} from "@angular/core";

export class IpcFileSession extends IpcClient implements FileSession {
  constructor(zone: NgZone, private token: string) {
    super(zone, 'file-session');
  }

  downloadTemp(remotePath: string): Promise<string> {
    return this.invoke('downloadTemp', this.token, remotePath);
  }

  get(remotePath: string, localPath: string): Promise<void> {
    return this.invoke('get', this.token, remotePath, localPath);
  }

  put(localPath: string, remotePath: string): Promise<void> {
    return this.invoke('put', this.token, localPath, remotePath);
  }

  readdir(location: string): Promise<FileEntry[]> {
    return this.invoke('readdir', this.token, location);
  }

  readdir_ext(location: string): Promise<FileItem[]> {
    return this.invoke('readdir_ext', this.token, location);
  }

  readlink(path: string): Promise<string> {
    return this.invoke('readlink', this.token, path);
  }

  rm(path: string, recursive: boolean): Promise<void> {
    return this.invoke('rm', this.token, path, recursive);
  }

  stat(path: string): Promise<Attributes> {
    return this.invoke('stat', this.token, path);
  }

  end(): Promise<void> {
    return this.invoke('close', this.token);
  }

  async uploadBatch(sources: string[], destination: string, error?: (name: string, error: Error) => Promise<boolean>): Promise<void> {
    for (const source of sources) {
      const filename: string = await basename(source);
      let result = false;
      do {
        try {
          await this.put(source, [destination, filename].join('/'));
        } catch (e) {
          if (!error) throw e;
          result = await error(filename, e as Error);
        }
      } while (result);
      if (result === null) {
        break;
      }
    }
  }

}