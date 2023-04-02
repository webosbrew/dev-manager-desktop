export declare interface Device {
  name: string;
  host: string;
  port: number;
  username: 'prisoner' | 'root' | string;
  profile: 'ose';
  privateKey?: { openSsh: string };
  passphrase?: string;
  password?: string;
  description?: string;
  default?: boolean;
  indelible?: boolean;
  files?: string;
}

export enum NewDeviceAuthentication {
  Password = 'password',
  LocalKey = 'localKey',
  DevKey = 'devKey'
};

export declare interface NewDeviceBase extends Omit<Device, 'privateKey' | 'passphrase' | 'password'> {
  new: true;
  name: string;
  description?: string;
  host: string;
  port: number;
  username: string;
}

export declare interface NewDeviceWithPassword extends NewDeviceBase {
  password: string;
}

export declare interface NewDeviceWithLocalPrivateKey extends NewDeviceBase {
  privateKey: {
    openSsh: string;
  };
  passphrase?: string;
}

export declare interface NewDeviceWithDevicePrivateKey extends NewDeviceBase {
  privateKey: {
    openSshData: string;
  };
  passphrase: string;
}

export type NewDevice = NewDeviceWithPassword | NewDeviceWithLocalPrivateKey | NewDeviceWithDevicePrivateKey;

export type DeviceLike = Device | NewDevice;
