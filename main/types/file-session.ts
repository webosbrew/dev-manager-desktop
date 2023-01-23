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
