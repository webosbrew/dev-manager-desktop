export interface Device {
  name: string;
  description: string;
  host: string;
  port: number;
  indelible: boolean;
  default: boolean;
  files: string;
  username: string;
  privateKey?: Buffer;
  passphrase?: string;
  password?: string;
  lunaAddr: {
    launch: LunaAddress;
  };
}

export interface LunaAddress {
  service: string;
  folder: string;
  method: string;
  returnValue: string;
}

export interface DeviceEditSpec {
  name: string;
  host: string;
  port: number;
  username: string;
  profile: 'ose';
  privateKey?: { openSsh: string };
  passphrase?: string;
  password?: string;

  description?: string;
  default?: boolean;
}

export interface Resolver {
  readonly devices: Device[];

  load(next: (error: any, result: any) => void): void;

  modifyDeviceFile(op: 'add' | 'modify' | 'default' | 'remove', device: Partial<DeviceEditSpec>, next: (error: any, result: any) => void): void;
}
