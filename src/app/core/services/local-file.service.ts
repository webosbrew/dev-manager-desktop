import {Injectable, NgZone} from "@angular/core";
import {BackendClient} from "./backend-client";

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

    async tempPath(extension: string): Promise<string> {
        return this.invoke('temp_path', {extension});
    }
}
