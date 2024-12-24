import {Component, OnDestroy, OnInit} from '@angular/core';
import {DeviceManagerService} from "../core/services";
import {Device, FileItem, FileSession} from "../types";
import {from, Observable, Subscription, tap} from "rxjs";
import {MessageDialogComponent} from "../shared/components/message-dialog/message-dialog.component";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {ProgressDialogComponent} from "../shared/components/progress-dialog/progress-dialog.component";
import {open as openPath} from '@tauri-apps/plugin-shell';
import {open as showOpenDialog, save as showSaveDialog} from '@tauri-apps/plugin-dialog';
import * as path from "path";
import {downloadDir} from "@tauri-apps/api/path";
import {CreateDirectoryMessageComponent} from "./create-directory-message/create-directory-message.component";

class FilesState {

    public breadcrumb: string[];

    constructor(public dir: string, public items?: FileItem[], public error?: Error) {
        this.breadcrumb = dir === '/' ? [''] : dir.split('/');
    }

    get completed(): boolean {
        return !!this.items || !!this.error;
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
    history?: HistoryStack;
    files$?: Observable<FilesState>;

    selectedItems: FileItem[] | null = null;

    private subscription?: Subscription;

    constructor(
        private modalService: NgbModal,
        public deviceManager: DeviceManagerService
    ) {
    }

    ngOnInit(): void {
        this.subscription = this.deviceManager.selected$.subscribe(async (selected) => {
            this.files$ = undefined;
            this.history = undefined;
            this.device = selected;
            this.session = selected && this.deviceManager.fileSession(selected);
            if (!selected) {
                return;
            }
            await this.cd('', true);
        });
    }

    ngOnDestroy(): void {
        this.subscription?.unsubscribe();
    }

    get hasSelection(): boolean {
        return (this.selectedItems?.length ?? 0) > 0;
    }

    get cwd(): string | null {
        return this.history?.current || null;
    }

    ls(dir: string = ''): Observable<FilesState> {
        const session = this.session;
        const comparator = this.compareName;

        async function* task() {
            if (!session) {
                throw new Error('No device selected');
            }
            if (!dir) {
                yield new FilesState('');
                dir = await session.home();
            }
            yield new FilesState(dir);
            console.log('ls', dir);
            let list = await session!.ls(dir);
            yield new FilesState(dir, list.sort(comparator), undefined);
        }

        return from(task());
    }

    async cd(dir: string = '', pushHistory: boolean = false): Promise<void> {
        if (!this.device) return;
        this.files$ = this.ls(dir).pipe(tap((state) => {
            if (!pushHistory || !state.completed || this.history?.current === state.dir) {
                return;
            }
            if (!this.history) {
                this.history = new HistoryStack(state.dir);
            } else {
                this.history.push(state.dir);
            }
        }));
        this.selectedItems = null;
    }

    async navBack(): Promise<void> {
        const path = this.history?.back();
        if (!path) {
            return;
        }
        await this.cd(path);
    }

    async navForward(): Promise<void> {
        const path = this.history?.forward();
        if (!path) {
            return;
        }
        await this.cd(path);
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
        return a.mtime - b.mtime;
    }

    async openItem(file: FileItem): Promise<void> {
        const cwd = this.history?.current;
        if (!cwd) return;
        switch (file.type) {
            case 'd': {
                await this.cd(path.join(cwd, file.filename), true);
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
        const cwd = this.history?.current;
        if (!cwd || !this.device) return;
        const progressRef = ProgressDialogComponent.open(this.modalService);
        const progress: ProgressDialogComponent = progressRef.componentInstance;
        let result = false;
        let tempPath: string | null = null;
        do {
            try {
                tempPath = await this.session!.getTemp(path.join(cwd, file.filename), (current, total) => {
                    progress.update('Pulling file from device', total ? current / total * 100 : undefined)
                });
            } catch (e) {
                result = await MessageDialogComponent.open(this.modalService, {
                    title: `Failed to download file ${file.filename}`,
                    message: (e as Error).message ?? String(e),
                    error: e as Error,
                    positive: 'Retry',
                    negative: 'Cancel',
                    cancellable: false,
                }).result;
            }
        } while (result);
        progressRef.dismiss();
        if (!tempPath) return;
        console.log(tempPath);
        await openPath(tempPath);
    }

    async downloadFiles(files: FileItem[] | null): Promise<void> {
        const cwd = this.history?.current;
        if (!cwd || !this.device) return;
        if (!files || !files.length) return;
        if (files.length == 1) {
            return await this.downloadFile(files[0]);
        }
        const returnValue = await showOpenDialog({
            directory: true,
            multiple: false,
            defaultPath: await downloadDir(),
        });
        if (!returnValue) return;
        const progress = ProgressDialogComponent.open(this.modalService);
        const target = returnValue as string;
        for (const file of files) {
            let result = false;
            do {
                try {
                    await this.session!.get(path.join(cwd, file.filename), target);
                } catch (e) {
                    result = await MessageDialogComponent.open(this.modalService, {
                        title: `Failed to download file ${file.filename}`,
                        message: (e as Error).message ?? String(e),
                        error: e as Error,
                        positive: 'Retry',
                        negative: 'Skip',
                        alternative: 'Abort',
                        cancellable: false,
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
        const cwd = this.history?.current;
        if (!cwd || !this.device) return;
        if (!files || !files.length) return;
        const answer = await MessageDialogComponent.open(this.modalService, {
            title: 'Are you sure to delete selected files?',
            message: 'Deleting files you don\'t know may break your TV',
            positive: 'Delete',
            negative: 'Cancel',
            positiveStyle: 'danger',
        }).result.catch(() => false);
        if (!answer) return;
        const progress = ProgressDialogComponent.open(this.modalService);
        for (const file of files) {
            let result = false;
            do {
                try {
                    await this.session!.rm(path.posix.join(cwd, file.filename), true);
                } catch (e) {
                    result = await MessageDialogComponent.open(this.modalService, {
                        title: `Failed to delete ${file.filename}`,
                        message: (e as Error).message ?? String(e),
                        error: e as Error,
                        positive: 'Retry',
                        negative: 'Skip',
                        alternative: 'Abort',
                        cancellable: false,
                    }).result;
                }
            } while (result);
            if (result === null) {
                break;
            }
        }
        await this.cd(cwd);
        progress.dismiss();
    }

    private async downloadFile(file: FileItem): Promise<void> {
        const cwd = this.history?.current;
        if (!cwd || !this.device) return;
        const returnValue = await showSaveDialog({defaultPath: file.filename});
        if (!returnValue) return;
        const progress = ProgressDialogComponent.open(this.modalService);
        let result = false;
        do {
            try {
                await this.session!.get(path.join(cwd, file.filename), returnValue);
            } catch (e) {
                result = await MessageDialogComponent.open(this.modalService, {
                    title: `Failed to download file ${file.filename}`,
                    message: (e as Error).message ?? String(e),
                    error: e as Error,
                    positive: 'Retry',
                    negative: 'Cancel',
                    cancellable: false,
                }).result;
            }
        } while (result);
        progress.dismiss();
    }

    async uploadFiles(): Promise<void> {
        const cwd = this.history?.current;
        if (!cwd || !this.device) return;
        const returnValue = await showOpenDialog({
            multiple: true,
            defaultPath: await downloadDir(),
        });
        if (!returnValue) return;
        const progressRef = ProgressDialogComponent.open(this.modalService);
        const progress: ProgressDialogComponent = progressRef.componentInstance;
        try {
            await this.session!.uploadBatch(returnValue, cwd,
                (name, index, total) => {
                    progress.update(`Uploading ${name} (${index + 1} / ${total})`, index / total * 100);
                },
                (copied, total) => {
                    progress.updateSecondary(undefined, copied / total * 100);
                },
                async (name, e): Promise<boolean> => {
                    const result = await MessageDialogComponent.open(this.modalService, {
                        title: `Failed to upload file ${name}`,
                        message: e.message ?? String(e),
                        error: e as Error,
                        positive: 'Retry',
                        negative: 'Skip',
                        alternative: 'Abort',
                        cancellable: false,
                    }).result;
                    if (result == null) throw e;
                    return result;
                });
            await this.cd(cwd);
        } finally {
            progressRef.dismiss();
        }
    }

    async createDirectory(): Promise<void> {
        const cwd = this.history?.current;
        if (!cwd || !this.device) return;
        const filename: string | false = await MessageDialogComponent.open(this.modalService, {
            title: 'Create Directory',
            size: 'md',
            message: CreateDirectoryMessageComponent,
            positive: 'Create',
            negative: 'Cancel',
        }).result.catch(() => false);
        if (!filename) {
            return;
        }
        const progress = ProgressDialogComponent.open(this.modalService);
        try {
            try {
                await this.session!.mkdir(path.join(cwd, filename));
            } catch (e) {
                await MessageDialogComponent.open(this.modalService, {
                    title: `Failed to create directory ${filename}`,
                    message: (e as Error).message ?? String(e),
                    error: e as Error,
                    positive: 'OK',
                    cancellable: false,
                }).result;
                throw e;
            }
            await this.cd(cwd);
        } finally {
            progress.dismiss();
        }
    }

    async breadcrumbNav(segs: string[]): Promise<void> {
        segs[0] = '/';
        await this.cd(path.join(...segs), true);
    }

}

class HistoryStack {
    private stack: string[] = [];
    private cursor: number;

    constructor(initial: string) {
        this.stack.push(initial);
        this.cursor = 0;
    }

    get current(): string {
        return this.stack[this.cursor];
    }

    get canForward(): boolean {
        return this.cursor < this.stack.length - 1;
    }

    get canBack(): boolean {
        return this.cursor > 0;
    }

    push(path: string) {
        this.stack.splice(this.cursor + 1);
        this.stack.push(path);
        if (this.stack.length > 10) {
            this.stack.splice(0, this.stack.length - 10);
            this.cursor = 9;
        } else {
            this.cursor += 1;
        }
    }

    back(): string | null {
        if (this.cursor == 0) {
            return null;
        }
        this.cursor -= 1;
        return this.stack[this.cursor] ?? null;
    }

    forward(): string | null {
        if (this.cursor >= this.stack.length - 1) {
            return null;
        }
        this.cursor += 1;
        return this.stack[this.cursor] ?? null;
    }

}
