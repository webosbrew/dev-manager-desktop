import {Attributes, FileEntry, FileItem} from "./file-session";
import {Device} from "./novacom-data";
import {ObservableInput, Observer} from "rxjs";


export declare interface CrashReportEntry {
  device: Device;
  path: string;
}

export declare interface Shell {
  closed(): Promise<boolean>;

  dumb(): Promise<boolean>;

  write(data: string): Promise<void>;

  resize(rols: number, cols: number, height: number, width: number): Promise<void>;

  buffer(): Promise<string>;

  close(): Promise<void>;
}

export declare interface SessionToken {
  key: string;
  device: Device;
}

export declare interface FileSession {

  readdir(location: string): Promise<FileEntry[]>;

  readdir_ext(location: string): Promise<FileItem[]>;

  readlink(path: string): Promise<string>;

  stat(path: string): Promise<Attributes>;

  rm(path: string, recursive: boolean): Promise<void>;

  get(remotePath: string, localPath: string): Promise<void>;

  put(localPath: string, remotePath: string): Promise<void>;

  downloadTemp(remotePath: string): Promise<string>;

  end(): Promise<void>;
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
  iconUri: string;
}
