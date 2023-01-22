export type FileType = '-' | 'd' | 'c' | 'b' | 's' | 'p' | 'l' | '';

export declare interface Attributes {
  mode: string;
  uid: string;
  gid: string;
  size: number;
  mtime: number;
}

export declare interface FileItem {
  filename: string;
  attrs: Attributes | null;
  link?: LinkInfo;
  type: FileType;
  abspath: string;
}

export declare interface LinkInfo {
  target: string;
  broken?: boolean;
}
