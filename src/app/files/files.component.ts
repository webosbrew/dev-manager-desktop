import {Component, OnDestroy, OnInit} from '@angular/core';
import {DeviceManagerService} from "../core/services";
import {Device, FileItem, FileSession} from "../types";
import {BehaviorSubject, Observable, Subject, Subscription} from "rxjs";
import {MessageDialogComponent} from "../shared/components/message-dialog/message-dialog.component";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {ProgressDialogComponent} from "../shared/components/progress-dialog/progress-dialog.component";
import {open as openPath} from '@tauri-apps/api/shell';
import {open as showOpenDialog, save as showSaveDialog} from '@tauri-apps/api/dialog';
import * as path from "path";
import moment from "moment";

class FilesState {

  public breadcrumb: string[];

  constructor(public dir: string, public items?: FileItem[], public error?: Error) {
    this.breadcrumb = dir.split('/');
  }
}

@Component({
  selector: 'app-files',
  templateUrl: './files.component.html',
  styleUrls: ['./files.component.scss']
})
export class FilesComponent implements OnInit, OnDestroy {
  device: Device | null = null;
  session: FileSession | null = null;
  pwd: string | null = null;
  files$: Observable<FilesState>;

  selectedItems: FileItem[] | null = null;

  private filesSubject: Subject<FilesState>;
  private subscription?: Subscription;

  constructor(
    private modalService: NgbModal,
    private deviceManager: DeviceManagerService,
  ) {
    this.filesSubject = new BehaviorSubject<FilesState>(new FilesState(''));
    this.files$ = this.filesSubject.asObservable();
  }

  ngOnInit(): void {
    this.subscription = this.deviceManager.selected$.subscribe((selected) => {
      this.device = selected;
      this.session = selected && this.deviceManager.fileSession(selected);
      this.cd('/media/developer', true);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get hasSelection(): boolean {
    return (this.selectedItems?.length ?? 0) > 0;
  }

  async cd(dir: string, showProgress = false): Promise<void> {
    if (!this.device) return;
    console.log('cd', dir);
    this.filesSubject.next(new FilesState(dir));
    let list: FileItem[];
    try {
      list = await this.session!.ls(dir);
    } catch (e) {
      console.warn(e);
      this.filesSubject.next(new FilesState(dir, undefined, e as Error));
      return;
    }
    this.pwd = dir;
    this.filesSubject.next(new FilesState(dir, list.sort(this.compareName), undefined));
    this.selectedItems = null;
  }

  compareName(this: void, a: FileItem, b: FileItem): number {
    const dirDiff = (b.type == 'd' ? 1000 : 0) - (a.type == 'd' ? 1000 : 0);
    if (dirDiff) return dirDiff;
    return a.filename.localeCompare(b.filename);
  }

  compareSize(this: void, a: FileItem, b: FileItem): number {
    return (a.type == '-' ? (a.size ?? 0) : 0) - (b.type == '-' ? (b.size ?? 0) : 0);
  }

  compareMtime(this: void, a: FileItem, b: FileItem): number {
    return moment(a.mtime).diff(moment(b.mtime));
  }

  async openItem(file: FileItem): Promise<void> {
    if (!this.pwd) return;
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

  selectionChanged(files: FileItem[] | null): void {
    this.selectedItems = files;
  }

  private async openFile(file: FileItem) {
    if (!this.pwd || !this.device) return;
    const progress = ProgressDialogComponent.open(this.modalService);
    let result = false;
    let tempPath: string | null = null;
    do {
      try {
        tempPath = await this.session!.getTemp(file.abspath);
      } catch (e) {
        result = await MessageDialogComponent.open(this.modalService, {
          title: `Failed to download file ${file.filename}`,
          message: (e as Error).message ?? String(e),
          positive: 'Retry',
          negative: 'Cancel',
        }).result;
      }
    } while (result);
    progress.dismiss();
    if (!tempPath) return;
    console.log(tempPath);
    await openPath(tempPath);
  }

  async downloadFiles(files: FileItem[] | null): Promise<void> {
    if (!this.pwd || !this.device) return;
    if (!files || !files.length) return;
    if (files.length == 1) {
      return await this.downloadFile(files[0]);
    }
    const returnValue = await showOpenDialog({directory: true, multiple: false});
    if (!returnValue) return;
    const progress = ProgressDialogComponent.open(this.modalService);
    const target = returnValue as string;
    for (const file of files) {
      let result = false;
      do {
        try {
          await this.session!.get(file.abspath, target);
        } catch (e) {
          result = await MessageDialogComponent.open(this.modalService, {
            title: `Failed to download file ${file.filename}`,
            message: (e as Error).message ?? String(e),
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
    progress.dismiss();
  }

  async removeFiles(files: FileItem[] | null): Promise<void> {
    if (!this.pwd || !this.device) return;
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
    for (const file of files) {
      let result = false;
      do {
        try {
          await this.session!.rm(file.abspath, true);
        } catch (e) {
          result = await MessageDialogComponent.open(this.modalService, {
            title: `Failed to delete ${file.filename}`,
            message: (e as Error).message ?? String(e),
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
    await this.cd(this.pwd, false);
    progress.dismiss();
  }

  private async downloadFile(file: FileItem): Promise<void> {
    if (!this.pwd || !this.device) return;
    const returnValue = await showSaveDialog({defaultPath: file.filename});
    if (!returnValue) return;
    const progress = ProgressDialogComponent.open(this.modalService);
    let result = false;
    do {
      try {
        await this.session!.get(file.abspath, returnValue);
      } catch (e) {
        result = await MessageDialogComponent.open(this.modalService, {
          title: `Failed to download file ${file.filename}`,
          message: (e as Error).message ?? String(e),
          positive: 'Retry',
          negative: 'Cancel',
        }).result;
      }
    } while (result);
    progress.dismiss();
  }

  async uploadFiles(): Promise<void> {
    if (!this.pwd || !this.device) return;
    const returnValue = await showOpenDialog({multiple: true});
    if (!returnValue) return;
    const progress = ProgressDialogComponent.open(this.modalService);
    await this.session!.uploadBatch(Array.isArray(returnValue) ? returnValue : [returnValue], this.pwd, async (name, e) => {
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
    await this.cd(this.pwd, false);
    progress.dismiss();
  }

  async breadcrumbNav(segs: string[]): Promise<void> {
    segs[0] = '/';
    await this.cd(path.join(...segs), true);
  }

}
