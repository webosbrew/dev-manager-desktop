import {SessionToken, Shell} from "../../../types";
import {IpcClient} from "./ipc-client";
import {Handle} from "../../../backend/ipc-backend";

export class IpcShellSession extends IpcClient implements Shell {
  constructor(private token: SessionToken) {
    super('shell-session');
  }

  closed(): Promise<boolean> {
    return this.call('closed', this.token);
  }

  dumb(): Promise<boolean> {
    return this.call('dumb', this.token);
  }

  close(): Promise<void> {
    return this.call('close', this.token);
  }

  write(data: string): Promise<void> {
    return this.call('write', this.token, data);
  }

  resize(rows: number, cols: number, height: number, width: number): Promise<void> {
    return this.call('resize', this.token, rows, cols, height, width);
  }

  buffer(): Promise<string> {
    return this.call('buffer', this.token);
  }

  listen(event: string, callback: (...args: any[]) => void): this {
    this.on(`${event}.${this.token.key}`, callback);
    return this;
  }

}
