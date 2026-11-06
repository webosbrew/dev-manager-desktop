import {ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {DomSanitizer, SafeHtml, SafeUrl} from '@angular/platform-browser';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {open as openExternal} from '@tauri-apps/plugin-shell';
import {Subscription} from 'rxjs';
import {Device} from '../types';
import {DeviceManagerService} from '../core/services';
import {MessageDialogComponent} from '../shared/components/message-dialog/message-dialog.component';
import {ProgressDialogComponent} from '../shared/components/progress-dialog/progress-dialog.component';
import {notesToHtml, UpdateRow, UpdatesService} from './updates.service';
import {author, Release, variantOf} from './release-core';

type View = 'list' | 'app' | 'add' | 'pick';

/**
 * Updates tab: tracks homebrew apps by their release links and updates them all at once. The list is kept
 * on this device (one per TV); the TV is only needed to see installed versions and to install.
 */
@Component({
    selector: 'app-updates',
    imports: [FormsModule, NgTemplateOutlet],
    templateUrl: './updates.component.html',
    styleUrl: './updates.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
})
export class UpdatesComponent implements OnInit, OnDestroy {
    view: View = 'list';
    device: Device | null = null;
    rows: UpdateRow[] | null = null;
    selected: UpdateRow | null = null;
    offline = false;
    loading = false;
    checkedAt: number | null = null;
    error: string | null = null;
    addUrl = '';
    addFilter = '';
    adding = false;
    addError: string | null = null;
    /** a looked-up link whose release has several .ipk files, waiting for the person to choose one */
    found: { url: string, name: string, release: Release, filter: string } | null = null;
    /** .ipk files of the selected app's newest release, for its Package menu */
    packages: { tag: string | null, names: string[], labels: Map<string, string>, sizes: Map<string, number> } | null = null;
    packagesFor: string | null = null;

    private sub?: Subscription;
    private retryTimer?: ReturnType<typeof setInterval>;
    private notesCache = new Map<string, SafeHtml>();

    constructor(private deviceManager: DeviceManagerService, private updates: UpdatesService,
                private modals: NgbModal, private cd: ChangeDetectorRef, private sanitizer: DomSanitizer) {
    }

    ngOnInit(): void {
        this.sub = this.deviceManager.selected$.subscribe(device => {
            this.device = device;
            this.rows = null;
            this.selected = null;
            this.offline = false;
            this.view = 'list';
            if (device) this.load(false);
        });
    }

    ngOnDestroy(): void {
        this.sub?.unsubscribe();
        clearInterval(this.retryTimer);
    }

    get pending(): UpdateRow[] {
        return (this.rows ?? []).filter(r => r.update);
    }

    /** Updates first, then by name */
    get sortedRows(): UpdateRow[] {
        return (this.rows ?? []).slice().sort((a, b) =>
            (Number(b.update) - Number(a.update)) || a.title.localeCompare(b.title));
    }

    /** Inner pages add a history entry, so the Back button returns to the list */
    show(view: View, row?: UpdateRow): void {
        if (view !== 'list' && this.view === 'list') history.pushState({updatesView: view}, '');
        this.view = view;
        if (row) this.selected = row;
        if (view === 'add') this.addError = null;
        if (view === 'app' && this.selected) this.loadPackages(this.selected);
        this.cd.markForCheck();
    }

    /** Looks up the selected app's packages once per visit, for the Package menu */
    private async loadPackages(row: UpdateRow): Promise<void> {
        if (this.packagesFor === row.app.appId) return;
        this.packagesFor = row.app.appId;
        this.packages = null;
        try {
            const release = await this.updates.packages(row.app);
            if (this.packagesFor !== row.app.appId) return;
            this.packages = {tag: release.tag, names: release.assets.map(a => a.name), labels: this.packageLabels(release),
                sizes: new Map(release.assets.map(a => [a.name, a.size || 0]))};
        } catch {
            this.packagesFor = null;
        } finally {
            this.cd.markForCheck();
        }
    }

    /** Which of the listed packages the app's filter picks */
    currentPackage(row: UpdateRow): string {
        const names = this.packages?.names ?? [];
        if (row.latest && names.includes(row.latest.ipkName)) return row.latest.ipkName;
        try {
            const re = row.app.filter ? new RegExp(row.app.filter, 'i') : null;
            return (re && names.find(n => re.test(n))) || '';
        } catch {
            return '';
        }
    }

    async choosePackage(row: UpdateRow, name: string): Promise<void> {
        if (!name || !this.packages) return;
        await this.setOption(row, {filter: this.updates.patternFor(name, this.packages.tag)});
    }

    back(): void {
        if (history.state?.updatesView) history.back(); else this.show('list');
    }

    @HostListener('window:popstate')
    onPopState(): void {
        if (this.view !== 'list') {
            this.view = 'list';
            this.found = null;
            this.cd.markForCheck();
        }
    }

    async load(refresh: boolean): Promise<void> {
        const device = this.device;
        if (!device) return;
        this.loading = true;
        this.error = null;
        this.cd.markForCheck();
        try {
            const result = await this.updates.rows(device, refresh);
            this.rows = result.rows;
            this.offline = result.offline;
            if (this.selected) this.selected = this.rows.find(r => r.app.appId === this.selected!.app.appId) ?? null;
            if (this.view === 'app' && !this.selected) this.view = 'list';
            this.checkedAt = Date.now();
        } catch (e) {
            this.error = String((e as Error).message ?? e).slice(0, 300);
        } finally {
            this.loading = false;
            this.cd.markForCheck();
        }
        // while the TV is off, look again every 30 seconds so versions and installs come back by themselves
        clearInterval(this.retryTimer);
        this.retryTimer = this.offline ? setInterval(() => { if (!this.loading) this.load(false); }, 30000) : undefined;
    }

    async add(): Promise<void> {
        if (!this.device || !this.addUrl.trim()) return;
        this.adding = true;
        this.addError = null;
        this.cd.markForCheck();
        try {
            const found = await this.updates.lookup(this.device, this.addUrl.trim(), this.addFilter.trim());
            // a filter typed in already says which package to use
            if (found.release.assets.length > 1 && !found.filter) {
                this.found = found;
                this.view = 'pick';
                return;
            }
            await this.finishAdd(found);
        } catch (e) {
            this.addError = String((e as Error).message ?? e).slice(0, 300);
        } finally {
            this.adding = false;
            this.cd.markForCheck();
        }
    }

    /** Adds the looked-up app with the chosen package (or its only one) */
    async finishAdd(found: { url: string, name: string, release: Release, filter: string }, ipkName?: string): Promise<void> {
        if (!this.device) return;
        this.adding = true;
        this.addError = null;
        this.cd.markForCheck();
        try {
            const app = await this.updates.add(this.device, found, ipkName);
            this.addUrl = '';
            this.addFilter = '';
            this.found = null;
            await this.load(false);
            const row = this.rows?.find(r => r.app.appId === app.appId);
            if (row) this.show('app', row); else this.back();
        } catch (e) {
            this.addError = String((e as Error).message ?? e).slice(0, 300);
        } finally {
            this.adding = false;
            this.cd.markForCheck();
        }
    }

    /** Leaves the package choice and returns to the link form */
    cancelPick(): void {
        this.found = null;
        this.view = 'add';
        this.cd.markForCheck();
    }

    /**
     * Friendly names for the packages of one release: the parts every file shares are dropped, so
     * "app_1.2_all.ipk" and "app_1.2_all_webOS22+.ipk" read "Standard" and "webOS 22 and newer".
     */
    packageLabels(release: Release): Map<string, string> {
        const parts = release.assets.map(a => variantOf(a.name, release.tag));
        const shared = parts[0]?.filter(p => parts.every(q => q.includes(p))) ?? [];
        const nice = (p: string) => {
            const os = /^webos[-_]?(\d+)(\+)?$/i.exec(p);
            if (os) return `webOS ${os[1]}${os[2] ? ' and newer' : ''}`;
            return ({all: 'Any TV', arm: 'ARM', armv7: 'ARM', armv7l: 'ARM', armhf: 'ARM', aarch64: 'ARM 64-bit',
                i686: 'x86', x86_64: 'x86 64-bit'} as Record<string, string>)[p.toLowerCase()] ?? p;
        };
        return new Map(release.assets.map((a, i) => {
            const own = parts[i].filter(p => !shared.includes(p)).map(nice);
            return [a.name, own.length ? own.join(' · ') : 'Standard'];
        }));
    }

    author(url: string): string {
        return author(url);
    }

    formatSize(bytes: number | undefined): string {
        if (!bytes) return '';
        return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
    }

    async install(rows: UpdateRow[]): Promise<void> {
        const device = this.device;
        if (!device || !rows.length) return;
        const ref = ProgressDialogComponent.open(this.modals);
        const dialog = ref.componentInstance as ProgressDialogComponent;
        const failed: string[] = [];
        try {
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                const prefix = rows.length > 1 ? `(${i + 1}/${rows.length}) ` : '';
                dialog.update(`${prefix}${r.title} ${r.latest?.version ?? ''}`);
                try {
                    await this.updates.install(device, r, (progress, status) =>
                        dialog.update(`${prefix}${r.title}: ${status ?? ''}`, progress));
                } catch (e) {
                    failed.push(`${r.title}: ${(e as Error).message ?? e}`);
                }
            }
        } finally {
            ref.close(true);
        }
        if (failed.length) {
            MessageDialogComponent.open(this.modals, {
                title: failed.length === rows.length ? 'Update failed' : 'Some updates failed',
                message: failed.join('\n'),
                positive: 'OK',
            });
        }
        await this.load(false);
    }

    async launch(row: UpdateRow): Promise<void> {
        if (!this.device) return;
        try {
            await this.updates.launch(this.device, row.app.appId);
        } catch (e) {
            MessageDialogComponent.open(this.modals, {
                title: 'Could not launch', message: `${row.title}: ${(e as Error).message ?? e}`, positive: 'OK',
            });
        }
    }

    async setOption(row: UpdateRow, patch: { prerelease?: boolean, filter?: string }): Promise<void> {
        if (!this.device) return;
        Object.assign(row.app, patch);
        this.updates.update(this.device, row.app.appId, patch);
        await this.load(true);
        if ('prerelease' in patch && this.selected) {
            this.packagesFor = null;
            this.loadPackages(this.selected);
        }
    }

    async remove(row: UpdateRow): Promise<void> {
        if (!this.device) return;
        const ok = await MessageDialogComponent.open(this.modals, {
            title: 'Remove app',
            message: `Stop tracking ${row.title}? The app itself stays installed on the TV.`,
            positive: 'Remove', positiveStyle: 'danger', negative: 'Cancel', autofocus: 'negative',
        }).result.catch(() => false);
        if (!ok) return;
        this.updates.remove(this.device, row.app.appId);
        this.selected = null;
        this.back();
        await this.load(false);
    }

    // ---- display helpers ------------------------------------------------------------------------

    icon(row: UpdateRow): SafeUrl | null {
        return row.iconUri ? this.sanitizer.bypassSecurityTrustUrl(row.iconUri) : null;
    }

    notes(row: UpdateRow): SafeHtml | null {
        const md = row.latest?.notes;
        if (!md?.trim()) return null;
        const key = `${row.app.appId}@${row.latest!.version}`;
        let html = this.notesCache.get(key);
        if (!html) {
            html = this.sanitizer.bypassSecurityTrustHtml(notesToHtml(md));
            this.notesCache.set(key, html);
        }
        return html;
    }

    date(iso: string | null | undefined): string {
        if (!iso) return '';
        const d = new Date(iso);
        return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    }

    time(ms: number | null): string {
        if (!ms) return 'never';
        const d = new Date(ms), p = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }

    initial(row: UpdateRow): string {
        return (row.title || '?').charAt(0).toUpperCase();
    }

    /** Links (source page, release, links inside release notes) open in the system browser */
    openLink(url: string | null | undefined, event?: Event): void {
        event?.preventDefault();
        if (url && /^https?:\/\//.test(url)) openExternal(url).catch(() => window.open(url, '_blank'));
    }

    notesClick(event: Event): void {
        const a = (event.target as HTMLElement).closest('a.note-link') as HTMLAnchorElement | null;
        if (a) this.openLink(a.getAttribute('href'), event);
    }
}
