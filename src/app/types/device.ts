export declare interface Device {
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
  indelible?: boolean;
  files?: string;
}

export declare interface NewDeviceBase extends Omit<Device, 'privateKey' | 'passphrase' | 'password'> {
  name: string;
  description?: string;
  host: string;
  port: number;
  username: string;
}

export declare interface NewDeviceWithPassword extends NewDeviceBase {
  newAuth: 'password';
  password: string;
}

export declare interface NewDeviceWithLocalPrivateKey extends NewDeviceBase {
  newAuth: 'localKey';
  privateKey: {
    openSsh: string;
  };
  passphrase?: string;
}

export declare interface NewDeviceWithDevicePrivateKey extends NewDeviceBase {
  newAuth: 'devKey';
  privateKey: {
    openSshData: string;
  };
  passphrase?: string;
}

export type NewDevice = NewDeviceWithPassword | NewDeviceWithLocalPrivateKey | NewDeviceWithDevicePrivateKey;

export type DeviceLike = Device | NewDevice;
