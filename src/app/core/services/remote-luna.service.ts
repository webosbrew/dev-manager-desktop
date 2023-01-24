import {escapeSingleQuoteString, RemoteCommandService} from "./remote-command.service";
import {Injectable} from "@angular/core";
import {Device, DeviceLike} from "../../types";

export declare interface LunaResponse extends Record<string, any> {
  returnValue: boolean,
  subscribed: boolean,
}

@Injectable({
  providedIn: 'root'
})
export class RemoteLunaService {
  constructor(private commands: RemoteCommandService) {
  }

  async call<T extends Record<string, any>>(device: DeviceLike, uri: string, param: Record<string, unknown> = {}, pub: boolean = true): Promise<T> {
    const sendCmd = pub ? 'luna-send-pub' : 'luna-send';
    return this.commands.exec(device, `${sendCmd} -n 1 ${uri} ${escapeSingleQuoteString(JSON.stringify(param))}`, 'utf-8')
      .then(out => {
        const typed: T & LunaResponse = JSON.parse(out.trim());
        if (!typed.returnValue) {
          throw new Error(out);
        }
        return typed;
      });
  }
}
