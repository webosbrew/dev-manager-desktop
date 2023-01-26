export type FileType = '-' | 'd' | 'c' | 'b' | 's' | 'p' | 'l' | '';

export declare interface FileItem {
  filename: string;
  type: FileType;
  mode: string;
  user: string;
  group: string;
  size: number,
  mtime: string,
  link?: LinkInfo;
  abspath: string;
}

export declare interface LinkInfo {
  target: string;
  broken?: boolean;
}

export declare interface FileSession {

  ls(path: string): Promise<FileItem[]>;

  rm(path: string, recursive: boolean): Promise<void>;

  get(remotePath: string, localPath: string): Promise<void>;

  put(localPath: string, remotePath: string): Promise<void>;

  getTemp(remotePath: string): Promise<string>;

  uploadBatch(strings: string[], pwd: string, failCb: (name: string, e: Error) => Promise<boolean>): Promise<void>;
}
