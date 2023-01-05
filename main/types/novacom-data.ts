import {Buffer} from "buffer";

export declare interface Device {
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

export declare interface LunaAddress {
  service: string;
  folder: string;
  method: string;
  returnValue: string;
}

export declare interface DeviceEditSpec {
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

