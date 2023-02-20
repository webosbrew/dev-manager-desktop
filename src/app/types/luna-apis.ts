import {LunaResponse} from "../core/services/remote-luna.service";

export declare interface SystemInfo extends LunaResponse {
  firmwareVersion: string;
  modelName: string;
  sdkVersion: string;
}

export declare interface HomebrewChannelConfiguration extends LunaResponse {
  root: boolean,
  telnetDisabled: boolean,
  failsafe: boolean,
  sshdEnabled: boolean,
  blockUpdates: boolean
}
