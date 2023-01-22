import {FileItem} from "./file-session";
import {Device} from "./novacom-data";


export declare interface CrashReportEntry {
  device: Device;
  path: string;
}

export declare interface FileSession {

  ls(path: string): Promise<FileItem[]>;

  rm(path: string, recursive: boolean): Promise<void>;

  get(remotePath: string, localPath: string): Promise<void>;

  put(localPath: string, remotePath: string): Promise<void>;

  getTemp(remotePath: string): Promise<string>;

  uploadBatch(strings: string[], pwd: string, failCb: (name: string, e: Error) => Promise<boolean>): Promise<void>;
}

export declare interface DevicePrivateKey {
  data: string;
  privatePEM?: string;
}

export declare interface RawPackageInfo {
  id: string;
  type: string;
  title: string;
  appDescription?: string;
  vendor: string;
  version: string;
  folderPath: string;
  icon: string;
}

export declare interface PackageInfo extends RawPackageInfo {
  iconUri?: string;
}
