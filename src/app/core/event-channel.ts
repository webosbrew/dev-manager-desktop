import {event} from '@tauri-apps/api';
import {UnlistenFn} from "@tauri-apps/api/event";

export abstract class EventChannel<RxPayload, ClosePayload> {
  private promise: Promise<UnlistenFn[]>;
  private isClosed: boolean = false;

  protected constructor(protected token: string) {
    this.promise = Promise.all([
      event.listen<RxPayload>(`${token}:rx`, (e) => {
        if (this.isClosed) {
          return;
        }
        this.onReceive(e.payload);
      }),
      event.once<ClosePayload>(`${token}:close`, (e) => {
        if (this.isClosed) {
          return;
        }
        this.isClosed = true;
        this.onClose(e.payload);
      }),
    ]);
  }

  public get closed(): boolean {
    return this.isClosed;
  }

  public async unlisten(): Promise<void> {
    console.log('EventChannel', 'unlisten all');
    return this.promise.then(list => list.forEach(f => f?.()));
  }

  public async send<P>(payload?: P): Promise<void> {
    return event.emit(`${this.token}:tx`, payload);
  }

  public async close<P>(payload?: P): Promise<void> {
    return event.emit(`${this.token}:close`, payload);
  }

  abstract onReceive(payload: RxPayload): void;

  abstract onClose(payload: ClosePayload): void;

}
