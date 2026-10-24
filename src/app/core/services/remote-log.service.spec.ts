import {ReplaySubject} from 'rxjs';
import {vi} from 'vitest';
import {RemoteLogService, LogMessage} from './remote-log.service';
import {CommandData, CommandSubject, RemoteCommandService} from './remote-command.service';
import {Device} from '../../types';

const device = {name: 'test-tv', host: '192.168.1.2'} as Device;
const timestamp = Date.UTC(2026, 6, 4, 12, 34, 56, 789);
const prefix = '2026-07-04T12:34:56.789Z [12345.678] user.info appinstalld';

describe('RemoteLogService PmLog parsing', () => {
    let stream: CommandSubject<string>;
    let service: RemoteLogService;
    let popen: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        stream = new ReplaySubject<CommandData<string>>() as CommandSubject<string>;
        stream.write = vi.fn().mockResolvedValue(undefined);
        popen = vi.fn().mockResolvedValue(stream);
        service = new RemoteLogService({popen} as unknown as RemoteCommandService);
    });
    afterEach(() => vi.useRealTimers());

    async function read(...lines: string[]): Promise<LogMessage[]> {
        const messages: LogMessage[] = [];
        const logs = await service.logread(device, 20);
        logs.subscribe(message => messages.push(message));
        lines.forEach(data => stream.next({fd: 0, data}));
        stream.complete();
        expect(popen).toHaveBeenCalledExactlyOnceWith(device, 'tail -f -n 20 /var/log/messages', 'utf-8');
        return messages;
    }

    it.each(['1234:5678', '1234:5', '1:5678', '1:2', ''])(
        'preserves log metadata for PID/TID [%s]', async ids => {
            const [message] = await read(`${prefix} [${ids}] APP_INSTALL INSTALL_START {"appId":"org.webosbrew.hbchannel","bytes":12345} Preparing installation`);
            expect(message).toMatchObject({
                monotonic: 12345.678, level: 'info', process: 'appinstalld',
                context: 'APP_INSTALL', msgid: 'INSTALL_START', message: 'Preparing installation',
                extras: {appId: 'org.webosbrew.hbchannel', bytes: 12345},
            });
            expect(message.datetime.toMillis()).toBe(timestamp);
        });

    it('separates nested JSON extras from a message containing braces', async () => {
        const extras = {appId: 'org.example.app', detail: {paths: ['/tmp/app.ipk'], text: 'value with } brace'}};
        const [message] = await read(`${prefix} [1:2] APP_INSTALL INSTALL_DONE ${JSON.stringify(extras)} Installed {org.example.app}`);
        expect(message.extras).toEqual(extras);
        expect(message.message).toBe('Installed {org.example.app}');
        expect(message.context).toBe('APP_INSTALL');
        expect(message.msgid).toBe('INSTALL_DONE');
    });

    it.each(['legacy log without PmLog metadata', `${prefix} [1234:] APP_INSTALL INVALID {} incomplete ID`])(
        'retains the fallback for an unrecognized line: %s', async line => {
            vi.useFakeTimers();
            vi.setSystemTime(timestamp);
            const [message] = await read(`  ${line}  `);
            expect(message).toMatchObject({
                process: 'unknown', context: 'unknown', level: 'info', message: line,
                monotonic: timestamp / 1000,
            });
            expect(message.datetime.toMillis()).toBe(timestamp);
        });

    it('omits empty and whitespace-only lines', async () => {
        expect(await read('', '  ', '\t')).toEqual([]);
    });
});
