import {ipcRenderer} from "electron";

export abstract class IpcClient {
  protected constructor(public category: string) {
  }

  protected call<T>(method: string, ...args: any[]): Promise<T> {
    // eslint-disable-next-line
    return this.callDirectly(this.category, method, ...args);
  }

  protected callDirectly<T>(category: string, method: string, ...args: any[]): Promise<T> {
    // eslint-disable-next-line
    return ipcRenderer.invoke(`${category}/${method}`, ...args);
  }

  protected on(method: string, handler: (...args: any[]) => void): void {
    ipcRenderer.on(`${this.category}/${method}`, (event, args) => handler(args));
  }

}
