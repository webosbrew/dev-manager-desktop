import {ipcRenderer} from "electron";

export abstract class IpcClient {
  protected constructor(public category: string) {
  }

  protected call(method: string, ...args: any[]): Promise<any> {
    return ipcRenderer.invoke(`${this.category}/${method}`, args);
  }

  protected on(method: string, handler: (...args: any[]) => void): void {
    ipcRenderer.on(`${this.category}/${method}`, (event, args) => handler(args));
  }
}
