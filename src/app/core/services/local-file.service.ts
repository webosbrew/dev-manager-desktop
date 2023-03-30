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
}
