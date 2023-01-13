import {tauri, event} from '@tauri-apps/api';
import {NgZone} from '@angular/core';

export abstract class IpcClient {
  protected constructor(protected zone: NgZone, public category: string) {
  }

  protected invoke<T>(method: string, ...args: any[]): Promise<T> {
    // eslint-disable-next-line
    return this.invokeDirectly(this.category, method, ...args);
  }

  protected invokeDirectly<T>(plugin: string, method: string, ...args: any[]): Promise<T> {
    // eslint-disable-next-line
    return new Promise<T>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      tauri.invoke(`plugin:${plugin}|${method}`, ...args)
        .then((result) => this.zone.run(() => resolve(result as any)))
        .catch(reason => this.zone.run(() => reject(reason)));
    });
  }

  protected on(method: string, handler: (..._: any[]) => void): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    event.listen(`${this.category}/${method}`, (event) =>
      this.zone.run(() => handler(event.payload)));
  }

}
