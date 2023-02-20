import {escapeSingleQuoteString, ExecutionError, RemoteCommandService} from "./remote-command.service";
import {Injectable} from "@angular/core";
import {DeviceLike} from "../../types";
import {catchError, finalize, Observable} from "rxjs";
import {map} from "rxjs/operators";
import {omit} from "lodash";

export declare interface LunaResponse extends Record<string, any> {
  returnValue: boolean,
  subscribed?: boolean,
}

@Injectable({
  providedIn: 'root'
})
export class RemoteLunaService {
  constructor(private commands: RemoteCommandService) {
  }

  async call<T extends LunaResponse>(device: DeviceLike, uri: string, param: Record<string, unknown> = {}, pub: boolean = true): Promise<T> {
    const sendCmd = pub ? 'luna-send-pub' : 'luna-send';
    return this.commands.exec(device, `${sendCmd} -n 1 ${uri} ${escapeSingleQuoteString(JSON.stringify(param))}`, 'utf-8')
      .catch(e => {
        if (ExecutionError.isCompatible(e) && e.status == 127) {
          throw new LunaUnsupportedError(`Failed to find command ${sendCmd}. Is this really a webOS device?`);
        }
        throw e;
      })
      .then(out => {
        let typed: T;
        try {
          typed = JSON.parse(out.trim());
        } catch (e) {
          console.warn('Invalid luna call response: ', out);
          throw new Error(`Bad response ${out}`);
        }
        if (!typed.returnValue) {
          throw new LunaResponseError(typed);
        }
        return typed;
      });
  }

  async subscribe<T extends LunaResponse>(device: DeviceLike, uri: string, param: Record<string, unknown> = {},
                                          pub: boolean = true): Promise<Observable<T>> {
    const sendCmd = pub ? 'luna-send-pub' : 'luna-send';
    const command = `${sendCmd} -i ${uri} ${escapeSingleQuoteString(JSON.stringify(param))}`;
    const subject = await this.commands.popen(device, command, 'utf-8');
    return subject.pipe(map(v => {
      console.log('luna subscribe', v);
      return JSON.parse(v.trim());
    }), catchError(e => {
      console.log(e);
      if (ExecutionError.isCompatible(e) && e.status == 127) {
        throw new LunaUnsupportedError(`Failed to find command ${sendCmd}. Is this really a webOS device?`);
      }
      throw e;
    }), finalize(() => subject.close()));
  }
}

export class LunaUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class LunaResponseError extends Error {
  declare returnValue: false;
  details: string;

  [values: string]: any;

  constructor(payload: Record<string, any>) {
    super(`Luna call returned negative response: ${payload['errorText']}`);
    this.details = payload['errorText'];
    Object.assign(this, omit(payload, 'message', 'reason', 'details'))
  }

  static isCompatible(e: any): e is LunaResponseError {
    return typeof (e.message) === 'string' && e.returnValue === false;
  }

}
