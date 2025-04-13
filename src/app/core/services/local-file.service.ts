import {Injectable, NgZone} from "@angular/core";
import {BackendClient} from "./backend-client";
import {ProgressCallback, progressChannel} from "./progress-callback";

@Injectable({
    providedIn: 'root'
})
export class LocalFileService extends BackendClient {
    constructor(zone: NgZone) {
        super(zone, 'local-file');
    }

    async checksum(path: string, algorithm: 'sha256'): Promise<string> {
        return this.invoke('checksum', {path, algorithm});
    }

    async remove(path: string, recursive: boolean = false): Promise<void> {
        await this.invoke('remove', {path, recursive});
    }

    async copy(source: string, target: string, progress?: ProgressCallback): Promise<void> {
        const onProgress = progressChannel(progress);
        await this.invoke('copy', {source, target, onProgress});
    }

    async tempPath(extension: string): Promise<string> {
        return this.invoke('temp_path', {extension});
    }
}
