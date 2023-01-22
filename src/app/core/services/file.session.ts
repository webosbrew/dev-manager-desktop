import {Device, FileItem, FileSession, FileType} from '../../../../main/types';
import {RemoteCommandService} from './remote-command.service';
import {zip} from 'lodash';
import * as path from 'path';
import moment from 'moment';

export class FileSessionImpl implements FileSession {
  constructor(private cmd: RemoteCommandService, private device: Device) {
  }

  async ls(path: string): Promise<FileItem[]> {
    const decoder = new TextDecoder();
    const entries: string[] = decoder.decode(await this.cmd.exec(this.device, `ls -A1 ${FileSessionImpl.escapeShellPath(path)}`))
      .split('\n').slice(0, -1);
    const details: string[] = decoder.decode(await this.cmd.exec(this.device, `ls -Al --full-time ${FileSessionImpl.escapeShellPath(path)}`))
      .split('\n').slice(1, -1);

    const items = zip(details, entries) as [string, string][];
    return Promise.resolve(items.filter(([detail, entry]) => detail && entry)
      .map(([detail, entry]) => FileSessionImpl.parseLsLine(path, detail.trimStart(), entry)));
  }

  rm(path: string, recursive: boolean): Promise<void> {
    return Promise.resolve(undefined);
  }

  getTemp(remotePath: string): Promise<string> {
    return this.cmd.getTemp(this.device, remotePath);
  }

  get(remotePath: string, localPath: string): Promise<void> {
    return this.cmd.get(this.device, remotePath, localPath);
  }

  put(localPath: string, remotePath: string): Promise<void> {
    return this.cmd.put(this.device, remotePath, localPath);
  }

  uploadBatch(strings: string[], pwd: string, failCb: (name: string, e: Error) => Promise<boolean>): Promise<void> {
    return Promise.reject(new Error("Unimplemented"));
  }

  private static parseLsLine(cwd: string, line: string, filename: string): FileItem {
    const mode = line.split(' ', 1)[0];
    const type = mode.charAt(0) as FileType;
    const abspath = path.join(cwd, filename);
    const infoPart = line.substring(0, (type === 'l' ? line.indexOf(`${filename} -> `) : line.length - filename.length) - 1);
    let columns: string[] = infoPart.split(/ +/);
    const mtime = columns.slice(-3);
    let nameStart = line.indexOf(filename);
    const nameSuffix = line.substring(nameStart + filename.length);
    return {
      filename, type, abspath,
      attrs: {
        mode: mode.substring(1),
        uid: columns[2],
        gid: columns[3],
        size: parseInt(columns[4], 10),
        mtime: moment(`${mtime[0]}T${mtime[1]}${mtime[2]}`).unix(),
      },
      link: nameSuffix.startsWith(' -> ') ? {
        target: nameSuffix.substring(4),
      } : undefined,
    }
  }

  private static escapeShellPath(path: string) {
    return path.split('\'').map(s => `'${s}'`).join('\\\'');
  }
}
