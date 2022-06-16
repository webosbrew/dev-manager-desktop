import {BrowserWindow, ipcMain} from 'electron';
import 'reflect-metadata';

type IpcHandleFunction = (...args: any[]) => Promise<any> | any;

export function Handle(target: IpcBackend, key: string | symbol, descriptor: PropertyDescriptor) {
  Reflect.defineMetadata('ipc:handler', descriptor.value, target, key);
}

export abstract class IpcBackend {

  protected constructor(private win: BrowserWindow, public category: string) {
    for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
      const metadata = Reflect.getMetadata('ipc:handler', this, key);
      if (metadata == null) continue;
      this.handle(key, metadata as IpcHandleFunction);
    }
  }

  protected handle(method: string, impl: IpcHandleFunction) {
    // eslint-disable-next-line
    ipcMain.handle(`${this.category}/${method}`, (event, ...args) => impl.call(this, ...args));
  }

  protected send(name: string, ...args: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.sendDirectly(this.category, `${name}`, ...args);
  }

  protected sendDirectly(category: string, name: string, ...args: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.win.webContents.send(`${category}/${name}`, ...args);
  }
}
