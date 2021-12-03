import {Handle, IpcBackend} from "../ipc-backend";
import {Device, FileItem, FileSession, SessionToken} from "../../types";
import {NovacomFileSession, SFTPSession} from "./file-session.impl";
import {DeviceManagerBackend} from "../device-manager/device-manager.backend";
import {v4 as UUIDv4} from 'uuid';
import {Attributes, FileEntry} from "ssh2-streams";
import {BrowserWindow} from "electron";

export class FileSessionBackend extends IpcBackend {
  private sessions: Map<string, FileSession> = new Map<string, FileSession>();

  constructor(win: BrowserWindow, private devices: DeviceManagerBackend) {
    super(win, 'file-session');
  }

  @Handle
  async open(device: Device): Promise<SessionToken> {
    const key = UUIDv4();
    const session = await this.newSession(device.name);
    this.sessions.set(key, session);
    return key;
  }

  @Handle
  async close(token: SessionToken): Promise<void> {
    const session = this.sessions.get(token);
    if (!session) throw new Error(`No such session ${token}`);
    this.sessions.delete(token);
    await session.end();
  }

  @Handle
  async readdir(token: SessionToken, location: string): Promise<FileEntry[]> {
    return (await this.session(token)).readdir(location);
  }

  @Handle
  async readdir_ext(token: SessionToken, location: string): Promise<FileItem[]> {
    return (await this.session(token)).readdir_ext(location);
  }

  @Handle
  async readlink(token: SessionToken, path: string): Promise<string> {
    return (await this.session(token)).readlink(path);
  }

  @Handle
  async rm(token: SessionToken, path: string, recursive: boolean): Promise<void> {
    return (await this.session(token)).rm(path, recursive);
  }

  @Handle
  async stat(token: SessionToken, path: string): Promise<Attributes> {
    return (await this.session(token)).stat(path);
  }

  @Handle
  async downloadTemp(token: SessionToken, remotePath: string): Promise<string> {
    return (await this.session(token)).downloadTemp(remotePath);
  }

  @Handle
  async get(token: SessionToken, remotePath: string, localPath: string): Promise<void> {
    return (await this.session(token)).get(remotePath, localPath);
  }

  @Handle
  async put(token: SessionToken, localPath: string, remotePath: string): Promise<void> {
    return (await this.session(token)).put(localPath, remotePath);
  }

  private session(token: SessionToken): Promise<FileSession> {
    const session = this.sessions.get(token);
    if (!session) return Promise.reject(new Error(`No such session ${token}`));
    return Promise.resolve(session);
  }

  private newSession(name: string): Promise<FileSession> {
    return this.sftpSession(name).catch(() => this.novacomFileSession(name));
  }

  private sftpSession(name: string): Promise<SFTPSession> {
    return this.devices.newSession(name).then(session => new Promise<SFTPSession>((resolve, reject) => {
      session.ssh.sftp((err, sftp) => {
        if (err) {
          reject(err);
        } else {
          resolve(new SFTPSession(sftp));
        }
      });
    }).then(async (sftp) => {
      try {
        await sftp.stat("/dev/null");
        return sftp;
      } catch (e) {
        await sftp.end();
        throw e;
      }
    }));
  }

  private novacomFileSession(name: string): Promise<FileSession> {
    return this.devices.newSession2(name).then(session => new NovacomFileSession(session));
  }
}
