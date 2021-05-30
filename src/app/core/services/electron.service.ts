// If you import a module but never use any of the imported values other than as TypeScript types,
// the resulting javascript file will look as if you never imported the module at all.

import { Injectable } from '@angular/core';
import * as novacom from '@webosose/ares-cli/lib/base/novacom';
import * as install from '@webosose/ares-cli/lib/install';
import * as launch from '@webosose/ares-cli/lib/launch';
import * as childProcess from 'child_process';
import { ipcRenderer, webFrame } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as ssh2 from 'ssh2';
import * as util from 'util';
import * as net from 'net';

@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  ipcRenderer: typeof ipcRenderer;
  webFrame: typeof webFrame;
  remote: Electron.Remote;
  childProcess: typeof childProcess;
  fs: typeof fs;
  path: typeof path;
  util: typeof util;
  net: typeof net;
  novacom: typeof novacom;
  installLib: typeof install;
  launchLib: typeof launch;
  ssh2: typeof ssh2;

  get isElectron(): boolean {
    return !!(window && window.process && window.process.type);
  }

  constructor() {
    // Conditional imports
    if (this.isElectron) {
      const electron = window.require('electron');
      this.ipcRenderer = electron.ipcRenderer;
      this.webFrame = electron.webFrame;
      this.remote = window.require('@electron/remote');

      // If you want to use remote object in renderer process, please set enableRemoteModule to true in main.ts
      // console.log('remote - globalShortcut', this.remote.globalShortcut);

      this.childProcess = window.require('child_process');
      this.fs = window.require('fs');
      this.path = window.require('path');
      this.util = window.require('util');
      this.net = window.require('net');
      this.ssh2 = window.require('ssh2');
      this.novacom = window.require('@webosose/ares-cli/lib/base/novacom');
      this.installLib = window.require('@webosose/ares-cli/lib/install');
      this.launchLib = window.require('@webosose/ares-cli/lib/launch');
    }
  }

  async downloadFile(url: string, target: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.ipcRenderer.send('downloadFile', url, target);
      this.ipcRenderer.once(`downloadFile:${url}`, (event, result) => {
        console.log(result);
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
        }
      });
    });
  }
}
