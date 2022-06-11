import {ipcRenderer} from "electron";
import {NgZone} from "@angular/core";

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
      ipcRenderer.invoke(`${category}/${method}`, ...args)
        .then((result: T) => this.zone.run(() => resolve(result)))
        .catch(reason => this.zone.run(() => reject(reason)));
    });
  }

  protected on(method: string, handler: (..._: any[]) => void): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    ipcRenderer.on(`${this.category}/${method}`, (event, args) => this.zone.run(() => handler(args)));
  }

}
