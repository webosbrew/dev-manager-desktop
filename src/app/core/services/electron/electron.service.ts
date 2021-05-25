// If you import a module but never use any of the imported values other than as TypeScript types,
// the resulting javascript file will look as if you never imported the module at all.

import { Injectable } from '@angular/core';
import * as remote from '@electron/remote';
import * as novacom from '@webosose/ares-cli/lib/base/novacom';
import * as install from '@webosose/ares-cli/lib/install';
import * as childProcess from 'child_process';
import { ipcRenderer, webFrame } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as ssh2 from 'ssh2';

@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  ipcRenderer: typeof ipcRenderer;
  webFrame: typeof webFrame;
  remote: typeof remote;
  childProcess: typeof childProcess;
  fs: typeof fs;
  path: typeof path;
  novacom: typeof novacom;
  installer: typeof install;
  ssh2: typeof ssh2;

  get isElectron(): boolean {
    return !!(window && window.process && window.process.type);
  }

  constructor() {
    // Conditional imports
    if (this.isElectron) {
      this.ipcRenderer = window.require('electron').ipcRenderer;
      this.webFrame = window.require('electron').webFrame;

      // If you want to use remote object in renderer process, please set enableRemoteModule to true in main.ts
      // this.remote = window.require('@electron/remote');
      // console.log('remote - globalShortcut', this.remote.globalShortcut);

      this.childProcess = window.require('child_process');
      this.fs = window.require('fs');
      this.path = window.require('path');
      this.novacom = window.require('@webosose/ares-cli/lib/base/novacom');
      this.installer = window.require('@webosose/ares-cli/lib/install');
      this.ssh2 = window.require('ssh2');
    }
  }
}
