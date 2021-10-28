import {Component, OnInit} from '@angular/core';
import {AsyncSFTPWrapper, DeviceManagerService, ElectronService} from "../../core/services";
import {Device} from "../../../types/novacom";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {Attributes, FileEntry} from 'ssh2-streams';
import * as path from 'path';

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
  path: typeof path;
  private filesSubject: Subject<FileItem[]>;

  constructor(
    private deviceManager: DeviceManagerService,
    private electron: ElectronService,
  ) {
    this.path = electron.path;
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
    console.log(dir);
    const sftp = await this.deviceManager.sftpSession(this.device.name);
    const list: FileItem[] = await Promise.all(await sftp.readdir(dir)
      .then(files => files.map(async (file): Promise<FileItem> => {
        if (FilesComponent.isSymlink(file)) {
          return FilesComponent.fromLink(sftp, dir, file.filename);
        } else {
          return FilesComponent.fromFile(dir, file);
        }
      }))).finally(() => sftp.end());
    this.pwd = dir;
    this.filesSubject.next(list.sort((a, b) => {
      const dirDiff = (b.isDirectory ? 1000 : 0) - (a.isDirectory ? 1000 : 0);
      return dirDiff + (a.filename > b.filename ? 1 : -1);
    }));
  }

  async onselect(file: FileItem): Promise<void> {
    if (file.isDirectory) {
      await this.cd(path.resolve(this.pwd, file.filename));
    }
  }

  async breadcrumbNav(segs: string[]): Promise<void> {
    await this.cd(segs.length > 1 ? path.join('/', ...segs) : '/');
  }

  private static isDirectory(file: FileEntry): boolean {
    return (file.attrs.mode & 0o0040000) == 0o0040000;
  }

  private static isRegularFile(file: FileEntry): boolean {
    return (file.attrs.mode & 0o0100000) == 0o0100000;
  }

  private static isSymlink(file: FileEntry): boolean {
    return (file.attrs.mode & 0o0120000) == 0o0120000;
  }

  private static async fromLink(sftp: AsyncSFTPWrapper, pwd: string, filename: string): Promise<FileItem> {
    const realpath = path.resolve(pwd, await sftp.readlink(path.resolve(pwd, filename)));
    console.log('Resolve link', pwd, filename, realpath);
    try {
      const stat = await sftp.stat(realpath);
      return {
        filename: filename,
        attrs: stat,
        link: {path: realpath},
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
      };
    } catch (e) {
      console.error('Failed to stat', realpath);
      return {
        filename: filename,
        attrs: null,
        link: {path: realpath, broken: true},
        isDirectory: false,
        isFile: false,
      };
    }
  }

  private static fromFile(dir: string, file: FileEntry): FileItem {
    return {
      filename: file.filename,
      attrs: file.attrs,
      isDirectory: FilesComponent.isDirectory(file),
      isFile: FilesComponent.isRegularFile(file)
    };
  }
}

declare interface FileItem {
  filename: string;
  attrs: Attributes;
  link?: LinkInfo;
  isDirectory: boolean;
  isFile: boolean;
}

declare interface LinkInfo {
  path: string;
  broken?: boolean;
}
