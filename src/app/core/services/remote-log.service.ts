import {Injectable} from "@angular/core";
import {escapeSingleQuoteString, RemoteCommandService} from "./remote-command.service";
import {Device, DeviceLike} from "../../types";
import {finalize, Observable} from "rxjs";
import {filter, map} from "rxjs/operators";
import matchBracket from "find-matching-bracket";
import {DateTime} from "luxon";
import {isNonNull} from "../../shared/operators";

@Injectable({
  providedIn: 'root'
})
export class RemoteLogService {
  constructor(private cmd: RemoteCommandService) {
  }


  async logread(device: Device, lastLines: number = 0): Promise<Observable<LogMessage>> {
    const subject = await this.cmd.popen(device, `tail -f -n ${lastLines} /var/log/messages`, 'utf-8');
    return subject.pipe(map(output => this.parsePmLog(output.data)),
      filter((msg): msg is LogMessage => isNonNull(msg)),
      finalize(() => subject.write()));
  }

  async dmesg(device: Device): Promise<Observable<LogMessage>> {
    const subject = await this.cmd.popen(device, `dmesg -w -x`, 'utf-8');
    return subject.pipe(map(output => this.parseDmesg(output.data)),
      filter((msg): msg is LogMessage => isNonNull(msg)),
      finalize(() => subject.write()));
  }

  async logClear(device: DeviceLike): Promise<void> {
    await this.cmd.exec(device, 'echo > /var/log/messages', 'utf-8');
  }

  async dmesgClear(device: DeviceLike): Promise<void> {
    await this.cmd.exec(device, 'dmesg -c', 'utf-8');
  }

  private parsePmLog(line: string): LogMessage | null {
    line = line.trim();
    if (!line) {
      return null;
    }
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
      msgid: groups.msgid,
      process: groups.process,
      message, extras,
    };
  }

  private parseDmesg(line: string): LogMessage | null {
    const match = line.match(/^(?<facility>\S+)\s*:(?<level>\S+)\s*:\s*\[\s*(?<monotonic>\d+\.\d+)]\s+(:?(?<context>.+?): )?(?<remaining>.+)$/);
    if (!match) {
      return null;
    }
    const groups: DmesgGroups = match.groups as DmesgGroups;
    return {
      datetime: DateTime.now(),
      monotonic: parseFloat(groups.monotonic),
      level: groups.level,
      context: groups.context,
      process: 'unknown',
      message: groups.remaining,
    };
  }

  async pmLogShow(device: DeviceLike): Promise<[string, LogLevel][]> {
    return this.cmd.exec(device, 'PmLogCtl show', 'utf-8').then((lines) => {
      return Array.from<RegExpMatchArray>(lines.matchAll(/^PmLogCtl: Context '([^']+)' = (.+)$/mg))
        .map((m): [string, LogLevel] => m.slice(1) as [string, LogLevel]);
    });
  }

  async pmLogSetLevel(device: DeviceLike, context: string, value: PrefLogLevel): Promise<string[]> {
    return await this.cmd.exec(device, `PmLogCtl set ${escapeSingleQuoteString(context)} ${value}`, 'utf-8').then((lines) => {
      return Array.from<RegExpMatchArray>(lines.matchAll(/^PmLogCtl: Setting context level for '([^']+)'/mg))
        .map((m): string => m[1]);
    });
  }
}

declare interface PmLogGroups extends Record<string, undefined | string> {
  datetime: string;
  monotonic: string;
  facility: string;
  level: LogLevel;
  process: string;
  pid?: string;
  tid?: string;
  context: string;
  msgid: string;
  remaining: string;
}

declare interface DmesgGroups extends Record<string, undefined | string> {
  facility: string;
  level: LogLevel;
  monotonic: string;
  context?: string;

  remaining: string;
}

export type LogLevel = 'emerg' | 'alert' | 'crit' | 'err' | 'warning' | 'notice' | 'info' | 'debug';

export type PrefLogLevel = LogLevel | 'none';

export interface LogMessage {
  datetime: DateTime,
  monotonic: number,
  level: LogLevel;
  process: string;
  context?: string;
  msgid?: string;
  message: string;
  extras?: Record<string, any>;
}
