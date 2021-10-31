import {Component, OnInit} from '@angular/core';
import {DeviceManagerService, ElectronService, SFTPSession} from "../../core/services";
import {Device} from "../../../types/novacom";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {Attributes, FileEntry} from 'ssh2-streams';
import * as path from 'path';
import * as fs from 'fs';
import {MessageDialogComponent} from "../../shared/components/message-dialog/message-dialog.component";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {SelectionType, SortType, TableColumn} from "@swimlane/ngx-datatable";

@Component({
  selector: 'app-files',
  templateUrl: './files.component.html',
  styleUrls: ['./files.component.scss']
})
export class FilesComponent implements OnInit {
  device: Device;
  pwd: string;
  files$: Observable<FileItem[]>;
  sizeOptions = {base: 2, standard: "jedec"};
  columns: TableColumn[] = [{prop: 'filename', name: 'Name'}];
  SortType = SortType;
  SelectionType = SelectionType;
  private remote: Electron.Remote;
  private filesSubject: Subject<FileItem[]>;
  private fs: typeof fs;

  constructor(
    private modalService: NgbModal,
    private deviceManager: DeviceManagerService,
    private electron: ElectronService,
  ) {
    this.remote = electron.remote;
    this.fs = electron.fs;
    deviceManager.selected$.subscribe((selected) => {
      this.device = selected;
      this.cd('/media/developer');
    });
    this.filesSubject = new BehaviorSubject([]);
    this.files$ = this.filesSubject.asObservable();
  }

  ngOnInit(): void {
  }

  async cd(dir: string): Promise<void> {
    if (!this.device) return;
    dir = path.normalize(dir);
    const sftp = await this.deviceManager.sftpSession(this.device.name);
    let list: FileItem[];
    try {
      list = await Promise.all(await sftp.readdir(dir)
        .then(files => files.map(async (file): Promise<FileItem> => {
          if (FilesComponent.isSymlink(file)) {
            return FilesComponent.fromLink(sftp, dir, file.filename);
          } else {
            return FilesComponent.fromFile(dir, file);
          }
        }))).finally(() => sftp.end());
    } catch (e) {
      MessageDialogComponent.open(this.modalService, {
        title: 'Failed to open directory',
        message: e.message ?? String(e),
        positive: 'OK',
      });
      return;
    }
    this.pwd = dir;
    this.filesSubject.next(list.sort(this.compareName.bind(this)));
  }

  compareName(a: FileItem, b: FileItem): number {
    const dirDiff = (b.type == 'dir' ? 1000 : 0) - (a.type == 'dir' ? 1000 : 0);
    return dirDiff + (a.filename > b.filename ? 1 : -1);
  }

  compareSize(a: FileItem, b: FileItem): number {
    return (a.type == 'file' ? (a.attrs?.size ?? 0) : 0) - (b.type == 'file' ? (b.attrs.size ?? 0) : 0);
  }

  async selectItem(file: FileItem): Promise<void> {

  }

  async openItem(file: FileItem): Promise<void> {
    switch (file.type) {
      case 'dir': {
        await this.cd(path.resolve(this.pwd, file.filename));
        break;
      }
      case 'file': {
        return await this.openFile(file);
      }
    }
  }

  private async openFile(file: FileItem) {
    const tempDir = path.join(this.remote.app.getPath('temp'), `devmgr`);
    if (!this.fs.existsSync(tempDir)) {
      this.fs.mkdirSync(tempDir);
    }
    const tempPath = path.join(tempDir, `${Date.now()}_${file.filename}`);
    const session = await this.deviceManager.newSession2(this.device.name);
    await session.get(file.abspath, tempPath).finally(() => session.end());
    await this.remote.shell.openPath(tempPath);
  }

  private async downloadFile(file: FileItem) {
    const returnValue = await this.remote.dialog.showSaveDialog({defaultPath: file.filename});
    if (returnValue.canceled) return;
    const session = await this.deviceManager.newSession2(this.device.name);
    await session.get(file.abspath, returnValue.filePath).finally(() => session.end())
      .catch((e) => MessageDialogComponent.open(this.modalService, {
        title: 'Failed to download file',
        message: e.message ?? String(e),
        positive: 'OK',
      }));
    return;
  }

  async breadcrumbNav(segs: string[]): Promise<void> {
    await this.cd(segs.length > 1 ? path.join('/', ...segs) : '/');
  }

  private static isSymlink(file: FileEntry): boolean {
    return (file.attrs.mode & 0o0120000) == 0o0120000;
  }

  private static getFileType(attrs: Attributes): FileType {
    if ((attrs.mode & 0o0100000) == 0o0100000) {
      return 'file';
    } else if ((attrs.mode & 0o0040000) == 0o0040000) {
      return 'dir';
    } else if ((attrs.mode & 0o0060000) == 0o0060000 || (attrs.mode & 0o0020000) == 0o0020000) {
      return 'device';
    } else {
      return 'special';
    }
  }

  private static async fromLink(sftp: SFTPSession, pwd: string, filename: string): Promise<FileItem> {
    const target = await sftp.readlink(path.isAbsolute(filename) ? filename : path.resolve(pwd, filename));
    const fullpath = path.isAbsolute(target) ? target : path.resolve(pwd, target);
    try {
      const stat = await sftp.stat(fullpath);
      return {
        filename: filename,
        attrs: stat,
        link: {target: target},
        type: FilesComponent.getFileType(stat),
        abspath: fullpath,
      };
    } catch (e) {
      console.error('Failed to stat', fullpath);
      return {
        filename: filename,
        attrs: null,
        link: {target: target, broken: true},
        type: 'invalid',
        abspath: fullpath,
      };
    }
  }

  private static fromFile(dir: string, file: FileEntry): FileItem {
    return {
      filename: file.filename,
      attrs: file.attrs,
      type: FilesComponent.getFileType(file.attrs),
      abspath: path.resolve(dir, file.filename),
    };
  }

  async itemActivated(file: FileItem, type: string): Promise<void> {
    switch (type) {
      case 'dblclick':
        return this.openItem(file);
    }
  }
}

type FileType = 'file' | 'dir' | 'device' | 'special' | 'invalid';

declare interface FileItem {
  filename: string;
  attrs: Attributes | null;
  link?: LinkInfo;
  type: FileType;
  abspath: string;
}

declare interface LinkInfo {
  target: string;
  broken?: boolean;
}
