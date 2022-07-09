export declare interface SystemInfo {
  firmwareVersion: string;
  modelName: string;
  sdkVersion: string;
}

export declare interface HomebrewChannelConfiguration {
  root: boolean,
  telnetDisabled: boolean,
  failsafe: boolean,
  sshdEnabled: boolean,
  blockUpdates: boolean
}
