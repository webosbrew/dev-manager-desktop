import {LunaResponse} from "../core/services/remote-luna.service";

export declare interface SystemInfo extends LunaResponse {
    firmwareVersion: string;
    modelName: string;
    sdkVersion: string;
    otaId: string;
}

export declare interface OsInfo extends LunaResponse {
    webos_manufacturing_version: string;
    webos_release: string;
}

export declare interface HomebrewChannelConfiguration extends LunaResponse {
    root: boolean,
    telnetDisabled: boolean,
    failsafe: boolean,
    sshdEnabled: boolean,
    blockUpdates: boolean
}
