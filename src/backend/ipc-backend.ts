import {ipcMain} from 'electron';
import 'reflect-metadata';

type IpcHandleFunction = (...args: any[]) => Promise<any>;

export function Handle(target: IpcBackend, key: string | symbol, descriptor: PropertyDescriptor) {
  Reflect.defineMetadata('ipc:handler', descriptor.value, target, key);
}

export abstract class IpcBackend {

  protected constructor(public category: string) {
    for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
      const metadata = Reflect.getMetadata('ipc:handler', this, key);
      if (!metadata) continue;
      this.handle(key, metadata as IpcHandleFunction);
    }
  }

  protected handle(method: string, impl: IpcHandleFunction) {
    ipcMain.handle(`${this.category}/${method}`, (event, args) => impl(args));
  }

  protected emit(name: string, ...args: any[]) {
    ipcMain.emit(`${this.category}/${name}`, args);
  }
}
