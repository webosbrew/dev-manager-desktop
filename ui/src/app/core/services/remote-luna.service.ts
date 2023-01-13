import {RemoteCommandService} from "./remote-command.service";
import {Injectable} from "@angular/core";
import {Device} from "../../../../../main/types";

declare interface LunaResponse extends Record<string, any> {
  returnValue: boolean,
  subscribed: boolean,
}

@Injectable({
  providedIn: 'root'
})
export class RemoteLunaService {
  constructor(private commands: RemoteCommandService) {
  }

  async call(device: Device, uri: string, param: Record<string, unknown> = {}, pub: boolean = true): Promise<LunaResponse> {
    return this.commands.exec(device, `luna-send -n 1 ${uri} '${JSON.stringify(param)}'`)
      .then(out => {
        const typed: LunaResponse = JSON.parse(out);
        if (!typed.returnValue) {
          throw new Error(out);
        }
        return typed;
      });
  }
}
