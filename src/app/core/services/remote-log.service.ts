import {Injectable} from "@angular/core";
import {RemoteCommandService} from "./remote-command.service";
import {Device} from "../../types";
import {finalize, Observable, tap} from "rxjs";
import {map} from "rxjs/operators";
import matchBracket from "find-matching-bracket";
import {DateTime} from "luxon";

@Injectable({
  providedIn: 'root'
})
export class RemoteLogService {
  constructor(private cmd: RemoteCommandService) {
  }


  async logread(device: Device, lastLines: number = 0): Promise<Observable<PmLogMessage>> {
    const subject = await this.cmd.popen(device, `tail -f -n ${lastLines} /var/log/messages`, 'utf-8');
    return subject.pipe(map(line => this.parsePmLog(line)), finalize(() => subject.close()));
  }

  private parsePmLog(line: string): PmLogMessage {
    const match = line.match(/^(?<datetime>[\w:.\-]+) \[(?<monotonic>\d+\.\d+)] (?<facility>\S+)\.(?<level>\S+) (?<process>\S+) \[((?<pid>\S):(?<tid>\S))?] (?<context>\S+) (?<msgid>\S+) (?<remaining>\{.+)$/);
    if (!match) {
      const now = DateTime.now();
      return {
        datetime: now,
        monotonic: now.toMillis() / 1000.0,
        process: 'unknown',
        context: 'unknown',
        level: 'info',
        message: line
      };
    }
    const groups: PmLogGroups = match.groups as PmLogGroups;
    const extrasEnd = matchBracket(groups.remaining, 0);
    let extras: Record<string, any> | undefined;
    try {
      extras = JSON.parse(groups.remaining.substring(0, extrasEnd + 1))
    } catch (e) {
      // Ignore
    }
    const message = groups.remaining.substring(extrasEnd + 1).trim();

    return {
      datetime: DateTime.fromISO(groups.datetime),
      monotonic: parseFloat(groups.monotonic),
      level: groups.level,
      context: groups.context,
      process: groups.process,
      message, extras,
    };
  }
}

declare interface PmLogGroups extends Record<string, undefined | string> {
  datetime: string;
  monotonic: string;
  facility: string;
  level: PmLogLevel;
  process: string;
  pid?: string;
  tid?: string;
  context: string;
  msgid: string;
  remaining: string;
}

export type PmLogLevel = 'emerg' | 'alert' | 'crit' | 'err' | 'warning' | 'notice' | 'info' | 'debug';

export interface PmLogMessage {
  datetime: DateTime,
  monotonic: number,
  level: PmLogLevel;
  process: string;
  context: string;
  message: string;
  extras?: Record<string, any>;
}
