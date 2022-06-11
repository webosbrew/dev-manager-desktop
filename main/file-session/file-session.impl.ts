import {Attributes, FileEntry, Stats} from "ssh2-streams";
import {cleanupSession} from "../util/ares-utils";
import {SFTPWrapper} from "ssh2";
import * as path from "path";
import * as stream from "stream";
import * as fs from "fs";
import {constants} from "fs";
import {FileItem, FileSession, FileType} from "../types";
import {app} from "electron";
import {minify} from 'terser';
import {promises} from "@webosbrew/ares-lib";
import {DeviceManagerBackend} from "../device-manager/device-manager.backend";
import Session = promises.Session;

abstract class AbsFileSession implements FileSession {
  async downloadTemp(remotePath: string): Promise<string> {
    const tempDir = path.join(app.getPath('temp'), `devmgr`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    const filename = path.posix.basename(remotePath);
    const tempPath: string = path.normalize(path.join(tempDir, `${Date.now()}_${filename}`));
    await this.get(remotePath, tempPath);
    return tempPath;
  }

  abstract end(): Promise<void>;

  abstract get(remotePath: string, localPath: string): Promise<void>;

  abstract put(localPath: string, remotePath: string): Promise<void>;

  abstract readdir(location: string): Promise<FileEntry[]>;

  abstract readdir_ext(location: string): Promise<FileItem[]>;

  abstract readlink(path: string): Promise<string>;

  abstract rm(path: string, recursive: boolean): Promise<void>;

  abstract stat(path: string): Promise<Attributes>;
}

export class NovacomFileSession extends AbsFileSession {

  constructor(private session: Session) {
    super();
  }

  public readdir(location: string): Promise<FileEntry[]> {
    // language=JavaScript
    const script = `
      var fs = require('fs');
      var path = require('path');
      var loc = process.argv[1];
      var dir = fs.readdirSync(loc);
      console.log(JSON.stringify(dir.map(function (filename) {
        var stat = fs.lstatSync(path.join(loc, filename));
        return {
          filename: filename,
          longname: filename,
          attrs: {
            mode: stat.mode,
            uid: stat.uid,
            gid: stat.gid,
            size: stat.size,
            atime: stat.atime.getTime() / 1000,
            mtime: stat.mtime.getTime() / 1000
          }
        }
      })));
    `;
    return this.runNodeCode(script, location).then(output => JSON.parse(output));
  }

  public async readdir_ext(location: string): Promise<FileItem[]> {
    // language=JavaScript
    const script = `
      var fs = require('fs');
      var path = require('path');
      var loc = process.argv[1];
      var dir = fs.readdirSync(loc);
      console.log(JSON.stringify(dir.map(function (filename) {
        var abspath = path.join(loc, filename);
        var stat = fs.lstatSync(abspath);
        var link = undefined;
        if (stat.isSymbolicLink()) {
          link = {target: fs.readlinkSync(abspath)};
          stat = fs.statSync(abspath);
        }
        return {
          filename: filename, abspath: abspath, link: link,
          attrs: {
            mode: stat.mode, uid: stat.uid, gid: stat.gid,
            size: stat.size, atime: stat.atime.getTime() / 1000, mtime: stat.mtime.getTime() / 1000
          }
        };
      })));
    `;
    return this.runNodeCode(script, location).then(output => JSON.parse(output).map((partial: Partial<FileItem>) => ({
      ...partial,
      type: getFileType(partial.attrs)
    })));
  }

  public readlink(path: string): Promise<string> {
    return DeviceManagerBackend.runAndGetOutput(this.session, `xargs -0 readlink -n`, stream.Readable.from(path));
  }

  public stat(path: string): Promise<Attributes> {
    // language=JavaScript
    const script = `
      var fs = require('fs');
      var stat = fs.statSync(process.argv[1]);
      console.log(JSON.stringify({
        mode: stat.mode,
        uid: stat.uid,
        gid: stat.gid,
        size: stat.size,
        atime: stat.atime.getTime() / 1000,
        mtime: stat.mtime.getTime() / 1000
      }));
    `;
    return this.runNodeCode(script, path).then(output => JSON.parse(output));
  }

  public async rm(path: string, recursive: boolean): Promise<void> {
    await DeviceManagerBackend.runAndGetOutput(this.session, `xargs -0 rm ${recursive ? '-r' : ''}`, stream.Readable.from(path));
  }

  public async get(remotePath: string, localPath: string): Promise<any> {
    return await this.session.get(remotePath, localPath);
  }

  public async put(localPath: string, remotePath: string): Promise<any> {
    return await this.session.put(localPath, remotePath);
  }

  public end(): Promise<void> {
    this.session.end();
    cleanupSession();
    return Promise.resolve();
  }

  private async runNodeCode(script: string, ...args: string[]): Promise<string> {
    const minified = (await minify(script)).code;
    const argstxt = args.map(arg => `'${arg.replace(/'/g, `'\\''`)}'`).join(' ');
    return DeviceManagerBackend.runAndGetOutput(this.session, `xargs -I {} node -e {} ${argstxt}`, stream.Readable.from(minified));
  }

}

export class SFTPSession extends AbsFileSession {
  constructor(private sftp: SFTPWrapper) {
    super();
  }

  public readdir(location: string): Promise<FileEntry[]> {
    return new Promise<FileEntry[]>((resolve, reject) => {
      this.sftp.readdir(location, (err, list) => {
        if (err) {
          reject(err);
        } else {
          resolve(list);
        }
      });
    });
  }

  public async readdir_ext(location: string): Promise<FileItem[]> {
    const entries = await this.readdir(location);
    const list = new Array(entries.length);
    for (let i = 0; i < entries.length; i++) {
      const file = entries[i];
      if (SFTPSession.isSymlink(file)) {
        list[i] = await SFTPSession.fromLink(this, location, file.filename);
      } else {
        list[i] = SFTPSession.fromFile(location, file);
      }
    }
    return list;
  }

  public readlink(path: string): Promise<string> {
    return new Promise<string>((resolve, reject) => this.sftp.readlink(path, (err, target) => {
      if (err) {
        reject(err);
      } else {
        resolve(target);
      }
    }));
  }

  public stat(path: string): Promise<Stats> {
    return new Promise<Stats>((resolve, reject) => this.sftp.stat(path, (err, stats) => {
      if (err) {
        reject(err);
      } else {
        resolve(stats);
      }
    }));
  }

  public async rm(filepath: string, recursive: boolean): Promise<void> {
    const stat = await this.stat(filepath);
    if (stat.isDirectory()) {
      if (!recursive) throw new Error(`${filepath} is a directory`);
      for (const child of await this.readdir(filepath)) {
        await this.rm(path.posix.join(filepath, child.filename), recursive);
      }
    } else {
      await this.unlink(filepath);
    }
  }

  public async get(remotePath: string, localPath: string): Promise<void> {
    return new Promise((resolve, reject) => this.sftp.fastGet(remotePath, localPath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    }));
  }

  public async put(localPath: string, remotePath: string): Promise<void> {
    return new Promise((resolve, reject) => this.sftp.fastPut(localPath, remotePath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    }));
  }

  public end(): Promise<void> {
    this.sftp.end();
    cleanupSession();
    return Promise.resolve();
  }

  private unlink(path: string): Promise<void> {
    return new Promise((resolve, reject) => this.sftp.unlink(path, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    }));
  }

  private static isSymlink(file: FileEntry): boolean {
    return (file.attrs.mode & 0o0120000) == 0o0120000;
  }

  private static async fromLink(session: FileSession, pwd: string, filename: string): Promise<FileItem> {
    const target = await session.readlink(path.isAbsolute(filename) ? filename : targetPath(pwd, filename));
    const fullpath = path.isAbsolute(target) ? target : targetPath(pwd, target);
    try {
      const stat = await session.stat(fullpath);
      return {
        filename: filename,
        attrs: stat,
        link: {target: target},
        type: getFileType(stat),
        abspath: fullpath,
      };
    } catch (e) {
      console.error('Failed to stat', fullpath);
      return {
        filename: filename,
        attrs: null,
        link: {target: target, broken: true},
        type: '',
        abspath: fullpath,
      };
    }
  }

  private static fromFile(dir: string, file: FileEntry): FileItem {
    return {
      filename: file.filename,
      attrs: file.attrs,
      type: getFileType(file.attrs),
      abspath: targetPath(dir, file.filename),
    };
  }
}

function S_ISTYPE(attrs: Attributes, type: number): boolean {
  return (attrs.mode & constants.S_IFMT) == type;
}

function getFileType(attrs: Attributes): FileType {
  if (S_ISTYPE(attrs, constants.S_IFREG)) {
    return '-';
  } else if (S_ISTYPE(attrs, constants.S_IFDIR)) {
    return 'd';
  } else if (S_ISTYPE(attrs, constants.S_IFLNK)) {
    return 'l';
  } else if (S_ISTYPE(attrs, constants.S_IFIFO)) {
    return 'p';
  } else if (S_ISTYPE(attrs, constants.S_IFSOCK)) {
    return 's';
  } else if (S_ISTYPE(attrs, constants.S_IFBLK)) {
    return 'b';
  } else if (S_ISTYPE(attrs, constants.S_IFCHR)) {
    return 'c';
  } else {
    return '';
  }
}

export function targetPath(...segments: string[]): string {
  return path.posix.resolve('/', ...segments);
}

