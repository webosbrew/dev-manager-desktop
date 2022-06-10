import {Component, OnInit} from '@angular/core';
import {DeviceManagerService} from "../../core/services";
import {Device, FileItem, FileSession} from "../../../types";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {MessageDialogComponent} from "../../shared/components/message-dialog/message-dialog.component";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {ContextmenuType, SelectionType, SortType, TableColumn} from "@swimlane/ngx-datatable";
import {ProgressDialogComponent} from "../../shared/components/progress-dialog/progress-dialog.component";
import {dialog, shell} from '@electron/remote';
import path from "path";

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
  selectedItems: FileItem[] | null = null;
  SortType = SortType;
  SelectionType = SelectionType;
  private filesSubject: Subject<FileItem[]>;

  constructor(
    private modalService: NgbModal,
    private deviceManager: DeviceManagerService,
  ) {
    deviceManager.selected$.subscribe((selected) => {
      this.device = selected;
      this.cd('/media/developer', true);
    });
    this.filesSubject = new BehaviorSubject([]);
    this.files$ = this.filesSubject.asObservable();
  }

  ngOnInit(): void {
  }

  get hasSelection(): boolean {
    return this.selectedItems && this.selectedItems.length > 0;
  }

  async cd(dir: string, showProgress = false): Promise<void> {
    if (!this.device) return;
    console.log('cd', dir);
    const progress = showProgress && ProgressDialogComponent.open(this.modalService);
    let session: FileSession;
    try {
      session = await this.deviceManager.openFileSession(this.device.name);
    } catch (e) {
      MessageDialogComponent.open(this.modalService, {
        title: 'Failed to start session',
        message: e.message ?? String(e),
        positive: 'OK',
      });
      progress?.dismiss();
      return;
    }
    let list: FileItem[];
    try {
      list = await session.readdir_ext(dir);
    } catch (e) {
      MessageDialogComponent.open(this.modalService, {
        title: 'Failed to open directory',
        message: e.message ?? String(e),
        positive: 'OK',
      });
      return;
    } finally {
      await session.end();
      progress?.dismiss();
    }
    this.pwd = dir;
    this.filesSubject.next(list.sort(this.compareName));
    this.selectedItems = null;
  }

  compareName(this: void, a: FileItem, b: FileItem): number {
    const dirDiff = (b.type == 'd' ? 1000 : 0) - (a.type == 'd' ? 1000 : 0);
    if (dirDiff) return dirDiff;
    return a.filename.localeCompare(b.filename);
  }

  compareSize(this: void, a: FileItem, b: FileItem): number {
    return (a.type == '-' ? (a.attrs?.size ?? 0) : 0) - (b.type == '-' ? (b.attrs.size ?? 0) : 0);
  }

  compareMtime(this: void, a: FileItem, b: FileItem): number {
    return (a.attrs?.mtime ?? 0) - (b.attrs?.mtime ?? 0);
  }

  async openItem(file: FileItem): Promise<void> {
    switch (file.type) {
      case 'd': {
        await this.cd(path.join(this.pwd, file.filename), true);
        break;
      }
      case '-': {
        return await this.openFile(file);
      }
    }
  }

  private async openFile(file: FileItem) {
    const session = await this.deviceManager.openFileSession(this.device.name);
    const progress = ProgressDialogComponent.open(this.modalService);
    let result = false;
    let tempPath: string = null;
    do {
      try {
        tempPath = await session.downloadTemp(file.abspath);
      } catch (e) {
        result = await MessageDialogComponent.open(this.modalService, {
          title: `Failed to download file ${file.filename}`,
          message: e.message ?? String(e),
          positive: 'Retry',
          negative: 'Cancel',
        }).result;
      }
    } while (result);
    progress.dismiss();
    await session.end();
    if (!result || !tempPath) return;
    await shell.openPath(tempPath);
  }

  async downloadFiles(files: FileItem[] | null): Promise<void> {
    if (!files || !files.length) return;
    if (files.length == 1) {
      return await this.downloadFile(files[0]);
    }
    const returnValue = await dialog.showOpenDialog({properties: ['openDirectory']});
    if (returnValue.canceled) return;
    const progress = ProgressDialogComponent.open(this.modalService);
    const session = await this.deviceManager.openFileSession(this.device.name);
    const target = returnValue.filePaths[0];
    for (const file of files) {
      let result = false;
      do {
        try {
          await session.get(file.abspath, target);
        } catch (e) {
          result = await MessageDialogComponent.open(this.modalService, {
            title: `Failed to download file ${file.filename}`,
            message: e.message ?? String(e),
            positive: 'Retry',
            negative: 'Skip',
            alternative: 'Abort',
          }).result;
        }
      } while (result);
      if (result === null) {
        break;
      }
    }
    await session.end();
    progress.dismiss();
  }

  async removeFiles(files: FileItem[] | null): Promise<void> {
    if (!files || !files.length) return;
    const answer = await MessageDialogComponent.open(this.modalService, {
      title: 'Are you sure to delete selected files?',
      message: 'Deleting files you don\'t know may break your TV',
      positive: 'Delete',
      negative: 'Cancel',
      positiveStyle: 'danger',
    }).result;
    if (!answer) return;
    const progress = ProgressDialogComponent.open(this.modalService);
    const session = await this.deviceManager.openFileSession(this.device.name);
    for (const file of files) {
      let result = false;
      do {
        try {
          await session.rm(file.abspath, true);
        } catch (e) {
          result = await MessageDialogComponent.open(this.modalService, {
            title: `Failed to delete ${file.filename}`,
            message: e.message ?? String(e),
            positive: 'Retry',
            negative: 'Skip',
            alternative: 'Abort',
          }).result;
        }
      } while (result);
      if (result === null) {
        break;
      }
    }
    await session.end();
    await this.cd(this.pwd, false);
    progress.dismiss();
  }

  private async downloadFile(file: FileItem): Promise<void> {
    const returnValue = await dialog.showSaveDialog({defaultPath: file.filename});
    if (returnValue.canceled) return;
    const progress = ProgressDialogComponent.open(this.modalService);
    const session = await this.deviceManager.openFileSession(this.device.name);
    let result = false;
    do {
      try {
        await session.get(file.abspath, returnValue.filePath);
      } catch (e) {
        result = await MessageDialogComponent.open(this.modalService, {
          title: `Failed to download file ${file.filename}`,
          message: e.message ?? String(e),
          positive: 'Retry',
          negative: 'Cancel',
        }).result;
      }
    } while (result);
    await session.end();
    progress.dismiss();
  }

  async uploadFiles(): Promise<void> {
    const returnValue = await dialog.showOpenDialog({properties: ['multiSelections', 'openFile']});
    if (returnValue.canceled) return;
    const progress = ProgressDialogComponent.open(this.modalService);
    const session = await this.deviceManager.openFileSession(this.device.name);
    await session.uploadBatch(returnValue.filePaths, this.pwd, async (name, e) => {
      const result = await MessageDialogComponent.open(this.modalService, {
        title: `Failed to upload file ${name}`,
        message: e.message ?? String(e),
        positive: 'Retry',
        negative: 'Skip',
        alternative: 'Abort',
      }).result;
      if (result == null) throw e;
      return result;
    });
    await session.end();
    await this.cd(this.pwd, false);
    progress.dismiss();
  }

  async breadcrumbNav(segs: string[]): Promise<void> {
    segs[0] = '/';
    await this.cd(path.join(...segs), true);
  }

  async itemActivated(file: FileItem, type: string): Promise<void> {
    switch (type) {
      case 'dblclick':
        return this.openItem(file);
    }
  }

  itemSelected(selected: FileItem[]): void {
    this.selectedItems = selected;
  }

  itemContextMenu(event: MouseEvent, type: ContextmenuType, content: any): void {
    if (type != ContextmenuType.body) return;
  }

}
