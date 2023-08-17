import {Device} from "./device";


export declare interface CrashReportEntry {
  device: Device;
  path: string;
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

export declare interface StorageInfo {
  total: number;
  used: number;
  available: number;
}
