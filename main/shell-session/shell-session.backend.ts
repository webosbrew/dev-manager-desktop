import {Handle, IpcBackend} from "../ipc-backend";
import {DeviceManagerBackend} from "../device-manager/device-manager.backend";
import {SessionToken, Shell} from "../../common/types";
import {v4 as UUIDv4} from "uuid";
import {RealShell, SimulateShell} from "./shell-session.impl";
import {ClientChannel} from "ssh2";
import * as util from "util";
import {BrowserWindow} from "electron";
import {Device, promises} from '@webosbrew/ares-lib';
import Session = promises.Session;

export class ShellSessionBackend extends IpcBackend {
  private sessions: Map<string, ShellSessionHolder> = new Map<string, ShellSessionHolder>();

  constructor(win: BrowserWindow, private devices: DeviceManagerBackend) {
    super(win, 'shell-session');
  }

  @Handle
  async open(device: Device): Promise<SessionToken> {
    if (!device) {
      throw new Error('device is null!');
    }
    const key = UUIDv4();
    const session = await this.newShell(device);
    session.listen('close', () => {
      this.send(`close.${key}`);
      this.sessions.delete(key);
      this.updateShells();
    });
    session.listen('data', (data: Buffer) => this.send(`data.${key}`, data.toString('binary')));
    const info: SessionToken = {key, device};
    this.sessions.set(key, new ShellSessionHolder(info, session));
    this.updateShells();
    return info;
  }

  @Handle
  async close(token: SessionToken): Promise<void> {
    const session = await this.session(token);
    await session.close();
    this.sessions.delete(token.key);
    this.updateShells();
    return Promise.resolve();
  }

  @Handle
  list(): SessionToken[] {
    return this.getShells();
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

  @Handle
  async resize(token: SessionToken, rows: number, cols: number, height: number, width: number): Promise<void> {
    return (await this.session(token)).resize(rows, cols, height, width);
  }

  @Handle
  async buffer(token: SessionToken): Promise<string> {
    return (await this.session(token)).buffer();
  }

  private session(token: SessionToken): Promise<Shell> {
    const session = this.sessions.get(token.key);
    if (!session) return Promise.reject(new Error(`No such session ${token.key}`));
    return Promise.resolve(session.shell);
  }

  private async newShell(device: Device): Promise<Shell> {
    return this.openDefaultShell(device).catch(() => this.openFakeShell(device));
  }

  async openDefaultShell(device: Device): Promise<Shell> {
    const session = await Session.create(device.name);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const shell: () => Promise<ClientChannel> = util.promisify(session.ssh.shell.bind(session.ssh));
    const stream = await shell();
    return new RealShell(session, stream);
  }

  async openFakeShell(device: Device): Promise<Shell> {
    const session = await Session.create(device.name);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const exec: (command: string) => Promise<ClientChannel> = util.promisify(session.ssh.exec.bind(session.ssh));
    const stream = await exec('sh');
    return new SimulateShell(session, stream);
  }

  private updateShells() {
    this.sendDirectly('device-manager', 'shellsUpdated', this.getShells());
  }

  private getShells(): SessionToken[] {
    return Array.from(this.sessions.values()).map(v => v.token);
  }
}

class ShellSessionHolder {
  constructor(public token: SessionToken, public shell: Shell) {
  }
}
