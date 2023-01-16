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

export type ShellObservable = ShellWritable & Observable<string>;

interface ShellWritable {
  write(data: string): Promise<void>;

}

export class ShellSubject extends Subject<string> implements ShellWritable {

  constructor(private shell: RemoteShellService, private token: ShellSessionToken) {
    super();
  }

  async write(data: string): Promise<void> {
    const payload: ShellMessage = {token: this.token, data: Array.from(new TextEncoder().encode(data))};
    await emit('shell-tx', payload);
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
      console.log('shell-rx', message, this.shellSessions, shell, String.fromCharCode(...message.data));
      if (shell) {
        shell.next(String.fromCharCode(...message.data));
      }
    }).then(noop);
    listen('shell-opened', e => {
      console.log('shell-opened', this.shellSessions, e.payload);
      this.shellSession(e.payload as ShellSessionToken);
    }).then(noop);
    this.list().then(shells => this.shellsSubject.next(shells));
    this.shellsSubject.subscribe(s => console.log('shells updated', s));
  }

  public async open(device: Device): Promise<ShellSessionToken> {
    return this.invoke('open', {device});
  }

  public async close(token: ShellSessionToken): Promise<void> {
    return this.invoke('close', {token});
  }

  public async list(): Promise<ShellSessionToken[]> {
    return this.invoke('list', {});
  }

  get shells$(): Observable<ShellSessionToken[]> {
    return this.shellsSubject.asObservable();
  }

  shellSession(token: ShellSessionToken): ShellObservable {
    let shell = this.shellSessions.get(token.id);
    if (!shell) {
      shell = new ShellSubject(this, token);
      this.shellSessions.set(token.id, shell);
    }
    return shell;
  }
}
