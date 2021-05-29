import { BrowserWindow } from 'electron';
import { download } from 'electron-dl';
import * as path from 'path';

export function DownloadFileHandler(event: Electron.IpcMainEvent, url: string, target: string): void {
  const win = BrowserWindow.getFocusedWindow();
  download(win, url, {
    directory: path.dirname(target),
    filename: path.basename(target),
  }).then(item => {
    event.reply(`downloadFile:${url}`, item.getSavePath());
  }).catch(error => {
    event.reply(`downloadFile:${url}`, error);
  });
}
