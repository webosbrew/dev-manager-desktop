import {contextBridge, ipcRenderer} from 'electron';

contextBridge.exposeInMainWorld('ipcRenderer', ipcRenderer);
