import {BehaviorSubject, noop, Observable, Subject} from "rxjs";
import {emit, listen} from "@tauri-apps/api/event";
import {IpcClient} from "./ipc-client";
import {Injectable, NgZone} from "@angular/core";
import {Device} from "../../../../main/types";


export interface ShellSessionToken {
  readonly name: string;
  readonly id: string;
}

export interface ShellMessage {
  token: ShellSessionToken;
  data: number[];
}

export interface ShellScreenContent {
  rows: Uint8Array[];
  cursor: [number, number];
}

export type ShellObservable = ShellWritable & Observable<string>;

interface ShellWritable {
  activate(rows: number, cols: number): Promise<void>;

  screen(rows: number, cols: number): Promise<ShellScreenContent>;

  write(data: string | Uint8Array): Promise<void>;

  resize(rows: number, cols: number): Promise<void>;
}

export class ShellSubject extends Subject<string> implements ShellWritable {
  private readonly encoder = new TextEncoder();

  constructor(private shell: RemoteShellService, private token: ShellSessionToken) {
    super();
  }

  async activate(rows: number, cols: number): Promise<void> {
    await this.shell.activate(this.token, rows, cols);
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

  private shellsSubject: Subject<ShellSessionToken[]>;
  private shellSessions: Map<string, ShellSubject> = new Map();

  constructor(zone: NgZone) {
    super(zone, 'remote-shell');
    this.shellsSubject = new BehaviorSubject<ShellSessionToken[]>([]);
    listen('shells-updated', e => {
      this.shellsSubject.next(e.payload as ShellSessionToken[]);
    }).then(noop);
    listen('shell-rx', e => {
      const message = e.payload as ShellMessage;
      const shell = this.shellSessions.get(message.token.id);
      if (shell) {
        shell.next(String.fromCharCode(...message.data));
      }
    }).then(noop);
    listen('shell-opened', e => {
      console.log('shell-opened', this.shellSessions, e.payload);
      this.obtain(e.payload as ShellSessionToken);
    }).then(noop);
    this.list().then(shells => this.shellsSubject.next(shells));
    this.shellsSubject.subscribe(s => console.log('shells updated', s));
  }

  async open(device: Device): Promise<ShellSessionToken> {
    return this.invoke('open', {device});
  }

  async close(token: ShellSessionToken): Promise<void> {
    return this.invoke('close', {token});
  }

  async list(): Promise<ShellSessionToken[]> {
    return this.invoke('list', {});
  }

  async activate(token: ShellSessionToken, rows: number, cols: number): Promise<void> {
    await this.invoke('activate', {token, rows, cols});
  }

  async screen(token: ShellSessionToken, rows: number, cols: number): Promise<ShellScreenContent> {
    return await this.invoke('screen', {token, rows, cols});
  }

  async write(token: ShellSessionToken, data: number[]): Promise<void> {
    await this.invoke('write', {token, data});
  }

  async resize(token: ShellSessionToken, rows: number, cols: number): Promise<void> {
    await this.invoke('resize', {token, rows, cols});
  }

  get shells$(): Observable<ShellSessionToken[]> {
    return this.shellsSubject.asObservable();
  }

  obtain(token: ShellSessionToken): ShellObservable {
    let shell = this.shellSessions.get(token.id);
    if (!shell) {
      shell = new ShellSubject(this, token);
      this.shellSessions.set(token.id, shell);
    }
    return shell;
  }
}
