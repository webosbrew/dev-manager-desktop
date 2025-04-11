import {fetch} from '@tauri-apps/plugin-http';
import {Injectable} from '@angular/core';
import {SemVer} from 'semver';

@Injectable({
    providedIn: 'root'
})
export class UpdateService {

    async getRecentRelease(): Promise<Release> {
        return fetch('https://api.github.com/repos/webosbrew/dev-manager-desktop/releases/latest', {
            headers: {'accept': 'application/vnd.github.v3+json'},

        }).then(async res => new ReleaseImpl(await res.json()));
    }

    get ignoreUntil(): SemVer | null {
        try {
            const value = localStorage.getItem('devManager:ignoreVersionUntil');
            if (!value) return null;
            return new SemVer(value, true);
        } catch (e) {
            return null;
        }
    }

    set ignoreUntil(value: SemVer | null) {
        if (value?.version) {
            localStorage.setItem('devManager:ignoreVersionUntil', value?.version);
        } else {
            localStorage.removeItem('devManager:ignoreVersionUntil');
        }
    }
}

export interface Release {
    readonly html_url: string;
    readonly tag_name: string;
    readonly body: string;
}

class ReleaseImpl implements Release {
    html_url: string = '';
    tag_name: string = '';
    body: string = '';

    constructor(data: Partial<ReleaseImpl>) {
        Object.assign(this, data);
    }

}
