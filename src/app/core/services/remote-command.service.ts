import {Injectable, NgZone} from "@angular/core";
import {IpcClient} from "./ipc-client";
import {Device} from "../../../../main/types";
import {listen} from '@tauri-apps/api/event';
import {BehaviorSubject, noop, Observable, Subject} from "rxjs";
import {ShellObservable, ShellSubject} from "./shell.session";

@Injectable({
  providedIn: 'root'
})
export class RemoteCommandService extends IpcClient {

  private shellsSubject: Subject<ShellSessionToken[]>;
  private shellSessions: Map<string, ShellSubject> = new Map();

  constructor(zone: NgZone) {
    super(zone, 'remote-command');
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
    });
    this.invoke<ShellSessionToken[]>('shells_list').then(shells => this.shellsSubject.next(shells));
    this.shellsSubject.subscribe(s => console.log('shells updated', s));
  }

  public async exec(device: Device, command: string, stdin?: string): Promise<string> {
    return this.invoke('exec', {device, command, stdin});
  }

  public async read(device: Device, path: string): Promise<Uint8Array> {
    return this.invoke('read', {device, path});
  }

  public async shell(device: Device): Promise<ShellSessionToken> {
    return this.invoke('shell_open', {device});
  }

  public async closeShell(token: ShellSessionToken): Promise<void> {
    return this.invoke('shell_close', {token});
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

export interface ShellSessionToken {
  readonly name: string;
  readonly id: string;
}

export interface ShellMessage {
  token: ShellSessionToken;
  data: number[];
}
