import {RemoteCommandService, ShellMessage, ShellSessionToken} from "./remote-command.service";
import {Observable, Subject} from "rxjs";
import {emit} from "@tauri-apps/api/event";

interface ShellWritable {
  write(data: string): Promise<void>;

}

export type ShellObservable = ShellWritable & Observable<string>;

export class ShellSubject extends Subject<string> implements ShellWritable {

  constructor(private cmd: RemoteCommandService, private token: ShellSessionToken) {
    super();
  }

  async write(data: string): Promise<void> {
    const payload: ShellMessage = {token: this.token, data: Array.from(new TextEncoder().encode(data))};
    await emit('shell-tx', payload);
  }

}
