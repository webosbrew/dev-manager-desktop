import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FileItem} from "../../types";
import {FileSizeOptionsBase} from "filesize";
import {type as osType} from "@tauri-apps/plugin-os";

interface KeyModifiers {
    shift: boolean;
    ctrl: boolean;
}

@Component({
    selector: 'app-files-table',
    templateUrl: './files-table.component.html',
    styleUrls: ['./files-table.component.scss']
})
export class FilesTableComponent {

    @Input()
    items?: FileItem[];

    @Output()
    opened: EventEmitter<FileItem> = new EventEmitter<FileItem>();

    @Output()
    selected: EventEmitter<FileItem[] | null> = new EventEmitter<FileItem[] | null>();

    sizeOptions: FileSizeOptionsBase = {base: 2, standard: "jedec"};

    selectedItems: FileItem[] | null = null;

    allowMultiple: boolean;

    constructor() {
        this.allowMultiple = !['android', 'ios'].includes(osType());
    }

    openItem(file: FileItem): void {
        this.selectedItems = null;
        this.selected.emit(this.selectedItems);
        this.opened.emit(file);
    }

    selectItem(file: FileItem, modifiers: KeyModifiers): void {
        if (!this.allowMultiple) {
            this.selectedItems = [file];
        } else if (modifiers.ctrl) {
            this.toggleItemSelection(file);
        } else if (modifiers.shift) {
            this.selectRange(file);
        } else {
            this.selectedItems = [file];
        }
        this.selected.emit(this.selectedItems);
    }

    keyModifiers(event: MouseEvent): KeyModifiers {
        return {
            shift: event.shiftKey,
            ctrl: event.ctrlKey || event.metaKey
        };
    }

    private toggleItemSelection(file: FileItem): void {
        if (this.selectedItems) {
            const index = this.selectedItems.indexOf(file);
            if (index >= 0) {
                this.selectedItems.splice(index, 1);
            } else {
                this.selectedItems.push(file);
            }
        } else {
            this.selectedItems = [file];
        }
        this.selected.emit(this.selectedItems);
    }

    private selectRange(file: FileItem): void {
        if (!this.selectedItems || this.selectedItems.length === 0) {
            this.selectedItems = [file];
            return;
        }
        let first = this.items?.indexOf(this.selectedItems[0]);
        let last = this.items?.indexOf(file);
        if (first === undefined || last === undefined) {
            return;
        }
        if (first > last) {
            const temp = first;
            first = last;
            last = temp;
        }
        this.selectedItems = this.items?.slice(first, last + 1) ?? null;
    }
}
