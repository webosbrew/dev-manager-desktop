import {BehaviorSubject, noop, Observable, Subject} from "rxjs";
import {listen} from "@tauri-apps/api/event";
import {IpcClient} from "./ipc-client";
import {Injectable, NgZone} from "@angular/core";
import {Device} from "../../types";
import {Buffer} from "buffer";
import {filter} from "rxjs/operators";
import {isNonNull} from "../../shared/operators";


export type ShellToken = string;

export interface ShellInfo {
  token: ShellToken;
  title: string;
  hasPty: boolean;
}

export interface ShellMessage {
  token: ShellToken;
  data: number[];
}

export interface ShellScreenContent {
  rows: Uint8Array[];
  cursor: [number, number];
}

export type ShellObservable = ShellWritable & Observable<Uint8Array>;

interface ShellWritable {

  screen(rows: number, cols: number): Promise<ShellScreenContent>;

  write(data: string | Uint8Array): Promise<void>;

  resize(rows: number, cols: number): Promise<void>;
}

export class ShellSubject extends Subject<Uint8Array> implements ShellWritable {
  private readonly encoder = new TextEncoder();

  constructor(private shell: RemoteShellService, private token: ShellToken) {
    super();
  }

  async screen(rows: number, cols: number): Promise<ShellScreenContent> {
    return await this.shell.screen(this.token, rows, cols);
  }

  async write(data: string | Uint8Array): Promise<void> {
    await this.shell.write(this.token, Array.from(typeof data === 'string' ? this.encoder.encode(data) : data));
  }

  async resize(rows: number, cols: number): Promise<void> {
    await this.shell.resize(this.token, rows, cols);
  }

}

@Injectable({
  providedIn: 'root'
})
export class RemoteShellService extends IpcClient {

  private shellsSubject: Subject<ShellInfo[] | null>;
  private shellSessions: Map<string, ShellSubject> = new Map();

  constructor(zone: NgZone) {
    super(zone, 'remote-shell');
    this.shellsSubject = new BehaviorSubject<ShellInfo[] | null>(null);
    listen('shells-updated', e => {
      this.shellsSubject.next(e.payload as ShellInfo[]);
    }).then(noop);
    listen('shell-rx', e => {
      const message = e.payload as ShellMessage;
      const shell = this.shellSessions.get(message.token);
      if (shell) {
        shell.next(Buffer.from(message.data));
      }
    }).then(noop);
    listen('shell-info', () => {
      this.list().then(l => this.shellsSubject.next(l));
    }).then(noop);
    listen('shell-opened', e => {
      console.log('shell-opened', this.shellSessions, e.payload);
      this.obtain(e.payload as ShellToken);
    }).then(noop);
    this.list().then(shells => this.shellsSubject.next(shells));
  }

  async open(device: Device, rows: number, cols: number): Promise<ShellInfo> {
    return this.invoke('open', {device, rows, cols});
  }

  async close(token: ShellToken): Promise<void> {
    return this.invoke('close', {token});
  }

  async list(): Promise<ShellInfo[]> {
    return this.invoke('list', {});
  }

  async screen(token: ShellToken, rows: number, cols: number): Promise<ShellScreenContent> {
    return await this.invoke('screen', {token, rows, cols});
  }

  async write(token: ShellToken, data: number[]): Promise<void> {
    await this.invoke('write', {token, data});
  }

  async resize(token: ShellToken, rows: number, cols: number): Promise<void> {
    await this.invoke('resize', {token, rows, cols});
  }

  get shells$(): Observable<ShellInfo[]> {
    return this.shellsSubject.pipe(filter(isNonNull));
  }

  obtain(token: ShellToken): ShellObservable {
    let shell = this.shellSessions.get(token);
    if (!shell) {
      shell = new ShellSubject(this, token);
      this.shellSessions.set(token, shell);
    }
    return shell;
  }

}
