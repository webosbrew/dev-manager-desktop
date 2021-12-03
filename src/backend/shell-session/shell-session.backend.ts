import {Handle, IpcBackend} from "../ipc-backend";
import {DeviceManagerBackend} from "../device-manager/device-manager.backend";
import {Device, SessionToken, Shell} from "../../types";
import {v4 as UUIDv4} from "uuid";
import {RealShell, SimulateShell} from "./shell-session.impl";
import {ClientChannel} from "ssh2";
import * as util from "util";
import {BrowserWindow} from "electron";

export class ShellSessionBackend extends IpcBackend {
  private sessions: Map<string, Shell> = new Map<string, Shell>();

  constructor(win: BrowserWindow, private devices: DeviceManagerBackend) {
    super(win, 'shell-session');
  }

  @Handle
  async open(device: Device): Promise<SessionToken> {
    const key = UUIDv4();
    const session = await this.newShell(device);
    session.listen('close', () => this.emit(`close.${key}`));
    session.listen('data', (data: Buffer) => this.emit(`data.${key}`, data.toString('binary')));
    this.sessions.set(key, session);
    return key;
  }

  @Handle
  async close(token: SessionToken): Promise<void> {
    const session = this.sessions.get(token);
    if (!session) throw new Error(`No such session ${token}`);
    this.sessions.delete(token);
    await session.close();
    return Promise.resolve();
  }

  @Handle
  async closed(token: SessionToken): Promise<boolean> {
    return (await this.session(token)).closed();
  }

  @Handle
  async dumb(token: SessionToken): Promise<boolean> {
    return (await this.session(token)).dumb();
  }

  @Handle
  async write(token: SessionToken, data: string): Promise<void> {
    return (await this.session(token)).write(data);
  }


  private session(token: SessionToken): Promise<Shell> {
    const session = this.sessions.get(token);
    if (!session) return Promise.reject(new Error(`No such session ${token}`));
    return Promise.resolve(session);
  }

  private async newShell(device: Device): Promise<Shell> {
    return this.openDefaultShell(device).catch(() => this.openFakeShell(device));
  }

  async openDefaultShell(device: Device): Promise<Shell> {
    const session = await this.devices.newSession(device.name);
    const shell: () => Promise<ClientChannel> = util.promisify(session.ssh.shell.bind(session.ssh));
    const stream = await shell();
    return new RealShell(stream);
  }

  async openFakeShell(device: Device): Promise<Shell> {
    const session = await this.devices.newSession(device.name);
    const exec: (command: string) => Promise<ClientChannel> = util.promisify(session.ssh.exec.bind(session.ssh));
    const stream = await exec('sh');
    return new SimulateShell(stream);
  }
}
