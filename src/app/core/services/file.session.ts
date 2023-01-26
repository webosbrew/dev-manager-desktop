import {Device, FileItem, FileSession, FileType} from '../../types';
import {escapeSingleQuoteString, RemoteCommandService} from './remote-command.service';
import {zip} from 'lodash';
import * as path from 'path';
import {basename} from '@tauri-apps/api/path'
import moment from 'moment';
import {RemoteFileService} from "./remote-file.service";

export class FileSessionImpl implements FileSession {
  constructor(private cmd: RemoteCommandService, private file: RemoteFileService, private device: Device) {
  }

  async ls(path: string): Promise<FileItem[]> {
    return this.file.ls(this.device, path);
  }

  async rm(path: string, recursive: boolean): Promise<void> {
    await this.cmd.exec(this.device, `xargs -0 rm ${recursive ? '-r' : ''}`, 'buffer', path);
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
