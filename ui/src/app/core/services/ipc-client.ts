import {invoke} from '@tauri-apps/api/tauri';
import {listen} from '@tauri-apps/api/event';
import {NgZone} from '@angular/core';

export abstract class IpcClient {
  protected constructor(protected zone: NgZone, public category: string) {
  }

  protected call<T>(method: string, ...args: any[]): Promise<T> {
    // eslint-disable-next-line
    return this.callDirectly(this.category, method, ...args);
  }

  protected callDirectly<T>(category: string, method: string, ...args: any[]): Promise<T> {
    // eslint-disable-next-line
    return new Promise<T>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      invoke(`${category}/${method}`, ...args)
        .then((result) => this.zone.run(() => resolve(result as any)))
        .catch(reason => this.zone.run(() => reject(reason)));
    });
  }

  protected on(method: string, handler: (..._: any[]) => void): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    listen(`${this.category}/${method}`, (event) =>
      this.zone.run(() => handler(event.payload)));
  }

}
