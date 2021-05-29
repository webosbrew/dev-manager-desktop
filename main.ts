import { app, BrowserWindow, protocol } from 'electron';
import * as windowStateKeeper from 'electron-window-state';
import * as path from 'path';
import * as url from 'url';
import { AresPullProtoHandler } from './src/backend/ares-pull-proto';
// Initialize remote module
require('@electron/remote/main').initialize();

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
    minWidth: 960,
    minHeight: 600,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: serve,
      contextIsolation: false,  // false if you want to run 2e2 test with Spectron
      enableRemoteModule: true, // true if you want to run 2e2 test  with Spectron or use remote module in renderer context (ie. Angular)
      devTools: serve
    },
  });

  mainWindowState.manage(win);
  win.setMenuBarVisibility(false);
  const loadApp = () => {

    if (serve) {

      win.webContents.openDevTools();

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
