import {Component, OnInit} from '@angular/core';
import {DeviceManagerService, ElectronService, SFTPSession} from "../../core/services";
import {Device} from "../../../types/novacom";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {Attributes, FileEntry} from 'ssh2-streams';
import * as path from 'path';
import {MessageDialogComponent} from "../../shared/components/message-dialog/message-dialog.component";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";

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
  private dialog: Electron.Dialog;
  private filesSubject: Subject<FileItem[]>;

  constructor(
    private modalService: NgbModal,
    private deviceManager: DeviceManagerService,
    private electron: ElectronService,
  ) {
    this.dialog = electron.remote.dialog;
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
    this.filesSubject.next(list.sort((a, b) => {
      const dirDiff = (b.type == 'dir' ? 1000 : 0) - (a.type == 'dir' ? 1000 : 0);
      return dirDiff + (a.filename > b.filename ? 1 : -1);
    }));
  }

  async onselect(file: FileItem): Promise<void> {
    if (file.type == 'dir') {
      await this.cd(path.resolve(this.pwd, file.filename));
    } else if (file.type == 'file') {
      const returnValue = await this.dialog.showSaveDialog({defaultPath: file.filename});
      if (returnValue.canceled) return;
      const sftp = await this.deviceManager.sftpSession(this.device.name);
      await sftp.fastGet(file.abspath, returnValue.filePath).finally(() => sftp.end())
        .catch((e) => MessageDialogComponent.open(this.modalService, {
          title: 'Failed to download file',
          message: e.message ?? String(e),
          positive: 'OK',
        }));
    }
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
}

type FileType = 'file' | 'dir' | 'device' | 'special' | 'invalid';

declare interface FileItem {
  filename: string;
  attrs: Attributes;
  link?: LinkInfo;
  type: FileType;
  abspath: string;
}

declare interface LinkInfo {
  target: string;
  broken?: boolean;
}
