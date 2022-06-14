import {app, BrowserWindow, protocol} from 'electron';
import windowStateKeeper from 'electron-window-state';
import path from 'path';
import url from 'url';
import {AresPullProtoHandler} from './main/ares-pull-proto';
import {DeviceManagerBackend} from "./main/device-manager/device-manager.backend";
import {AppManagerBackend} from "./main/app-manager.backend";
import {skipCORS} from "./main/cors-skip";
import {FileSessionBackend} from "./main/file-session/file-session.backend";
import {ShellSessionBackend} from "./main/shell-session/shell-session.backend";
import electronDl from "electron-dl";

// Initialize remote module
import * as main from '@electron/remote/main';

main.initialize();

electronDl();

const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1024,
    defaultHeight: 720
  });
  const win = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 800,
    minHeight: 500,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInSubFrames: true,
      allowRunningInsecureContent: serve,
      contextIsolation: false,
    },
  });

  mainWindowState.manage(win);
  win.setMenuBarVisibility(false);
  const loadApp = () => {

    if (serve) {

      // win.webContents.openDevTools();

      win.loadURL('http://localhost:4210');

    } else {
      win.loadURL(url.format({
        pathname: path.join(__dirname, 'ui/index.html'),
        protocol: 'file:',
        slashes: true
      }));
    }
  };
  loadApp();

  win.webContents.on('did-fail-load', () => loadApp());
  skipCORS(win.webContents.session);
  main.enable(win.webContents);
  const devMgr = new DeviceManagerBackend(win);
  new AppManagerBackend(win);
  new FileSessionBackend(win, devMgr);
  new ShellSessionBackend(win, devMgr);
  return win;
}

try {
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  // Added 400 ms to fix the black background issue while using transparent window. More details at https://github.com/electron/electron/issues/15947
  app.on('ready', () => setTimeout(createWindow, 400));

  app.whenReady().then(() => {
    protocol.registerBufferProtocol('ares-pull', AresPullProtoHandler);
  });

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    app.quit();
  });
} catch (e) {
  // Catch Error
  // throw e;
}
