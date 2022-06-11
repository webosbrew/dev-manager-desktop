import {app, BrowserWindow, protocol} from 'electron';
import windowStateKeeper from 'electron-window-state';
import path from 'path';
import url from 'url';
import {AresPullProtoHandler} from './ares-pull-proto';
import {DeviceManagerBackend} from "./device-manager/device-manager.backend";
import {AppManagerBackend} from "./app-manager.backend";
import {skipCORS} from "./cors-skip";
import {FileSessionBackend} from "./file-session/file-session.backend";
import {ShellSessionBackend} from "./shell-session/shell-session.backend";
import electronDl from "electron-dl";

// Initialize remote module
require('@electron/remote/main').initialize();

electronDl();

let win: BrowserWindow = null;
const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1024,
    defaultHeight: 720
  });
  win = new BrowserWindow({
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

      require('electron-reload')(__dirname, {
        electron: require(`${__dirname}/node_modules/electron`)
      });
      win.loadURL('http://localhost:4210');

    } else {
      win.loadURL(url.format({
        pathname: path.join(__dirname, 'dist/index.html'),
        protocol: 'file:',
        slashes: true
      }));
    }
  };
  loadApp();

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store window
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });
  win.webContents.on('did-fail-load', () => loadApp());
  skipCORS(win.webContents.session);
  require('@electron/remote/main').enable(win.webContents);
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
  // Added 400 ms to fix the black background issue while using transparent window. More detais at https://github.com/electron/electron/issues/15947
  app.on('ready', () => setTimeout(createWindow, 400));

  app.whenReady().then(() => {
    protocol.registerBufferProtocol('ares-pull', AresPullProtoHandler);

  });

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      createWindow();
    }
  });
} catch (e) {
  // Catch Error
  // throw e;
}
