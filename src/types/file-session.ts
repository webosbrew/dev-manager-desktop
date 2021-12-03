export type FileType = '-' | 'd' | 'c' | 'b' | 's' | 'p' | 'l' | '';

export declare interface Attributes {
  mode: number;
  uid: number;
  gid: number;
  size: number;
  atime: number;
  mtime: number;
}

export declare interface FileEntry {
  filename: string;
  longname: string;
  attrs: Attributes;
}

export declare interface FileItem {
  filename: string;
  attrs: Attributes | null;
  link?: LinkInfo;
  type: FileType ;
  abspath: string;
}

export declare interface LinkInfo {
  target: string;
  broken?: boolean;
}
