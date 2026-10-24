import {NgZone} from '@angular/core';
import {Mock, vi} from 'vitest';
import {AppManagerService, InstallError} from './app-manager.service';
import {CommandSubject, RemoteCommandService} from './remote-command.service';
import {LunaResponseError, LunaSubscription, RemoteLunaService} from './remote-luna.service';
import {RemoteFileService} from './remote-file.service';
import {LocalFileService} from './local-file.service';
import {DeviceManagerService} from './device-manager.service';
import {Device} from '../../types';

const device = {name: 'test-tv', host: '192.168.1.2'} as Device;
const idle = 10 * 60 * 1_000;

describe('AppManagerService uninstall response waiting', () => {
    let service: AppManagerService;
    let proc: CommandSubject<string>;
    let luna: LunaSubscription<unknown>;
    let subscribe: ReturnType<typeof vi.fn>;
    let load: Mock<AppManagerService['load']>;

    beforeEach(() => {
        vi.useFakeTimers();
        proc = new CommandSubject<string>({run: (fn: () => void) => fn()} as NgZone,
            'remove-process', 'luna-send-pub -i remove', 'utf-8');
        vi.spyOn(proc, 'write').mockResolvedValue(undefined);
        luna = new LunaSubscription(proc, 'remove-test');
        subscribe = vi.fn().mockResolvedValue(luna);
        service = new AppManagerService({subscribe} as unknown as RemoteLunaService,
            {} as RemoteCommandService, {} as RemoteFileService, {} as LocalFileService, {} as DeviceManagerService);
        load = vi.spyOn(service, 'load').mockResolvedValue([]);
    });
    afterEach(async () => {
        // Even the original unbounded implementation is released after an assertion fails.
        const cleanup = luna.unsubscribe();
        await vi.advanceTimersByTimeAsync(5_000);
        await cleanup;
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    async function start() {
        const outcome: {settled: boolean; error?: unknown} = {settled: false};
        const result = service.remove(device, 'test.app').then(() => {
            outcome.settled = true;
        }, error => {
            outcome.settled = true;
            outcome.error = error;
        });
        await vi.advanceTimersByTimeAsync(0);
        expect(subscribe).toHaveBeenCalledExactlyOnceWith(device,
            'luna://com.webos.appInstallService/dev/remove', {id: 'test.app', subscribe: true});
        return {outcome, result};
    }

    function message(payload: object) {
        proc.next({fd: 0, data: JSON.stringify(payload)});
    }

    it('bounds a silent uninstall and releases process listeners without refreshing apps', async () => {
        const {outcome} = await start();
        await vi.advanceTimersByTimeAsync(idle + 5_000);
        expect(outcome.settled).toBe(true);
        expect(outcome.error).toMatchObject({message: 'No uninstallation response from the TV for 10 minutes. Check the TV connection and Developer Mode.'});
        expect(load).not.toHaveBeenCalled();
        expect(proc.isStopped).toBe(true);
        expect(proc.observed).toBe(false);
    });

    it('renews the inactivity window on progress but fails when progress stops', async () => {
        const {outcome} = await start();
        for (let i = 0; i < 3; i++) {
            await vi.advanceTimersByTimeAsync(idle - 60_000);
            message({returnValue: true, details: {state: 'removing', progress: i}});
        }
        expect(outcome.settled).toBe(false);
        expect(load).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(idle + 5_000);
        expect(outcome.settled).toBe(true);
        expect(outcome.error).toMatchObject({message: expect.stringContaining('No uninstallation response')});
        expect(load).not.toHaveBeenCalled();
    });

    it.each([false, true])('reports EOF before a terminal result (progress=%s)', async progress => {
        const {outcome, result} = await start();
        if (progress) message({returnValue: true, details: {state: 'removing'}});
        proc.complete();
        await result;
        expect(outcome.error).toMatchObject({message: 'Uninstallation connection closed before the TV reported a result.'});
        expect(load).not.toHaveBeenCalled();
    });

    it.each(['removed', 'SUCCESS'])('accepts %s without process close and refreshes once', async state => {
        const {outcome, result} = await start();
        message({returnValue: true, details: {state}});
        await vi.advanceTimersByTimeAsync(5_000);
        await result;
        expect(outcome.error).toBeUndefined();
        expect(load).toHaveBeenCalledExactlyOnceWith(device);
        expect(proc.write).toHaveBeenCalledTimes(1);
        expect(proc.isStopped).toBe(true);
    });

    it('keeps the first terminal success if a later error arrives before process close', async () => {
        const {outcome, result} = await start();
        message({returnValue: true, details: {state: 'removed'}});
        message({returnValue: false, errorText: 'late error'});
        await vi.advanceTimersByTimeAsync(5_000);
        await result;
        expect(outcome.error).toBeUndefined();
        expect(load).toHaveBeenCalledExactlyOnceWith(device);
    });

    it.each([false, true])('preserves top-level failure details (EOF=%s)', async eof => {
        const {outcome, result} = await start();
        message({returnValue: false, errorCode: -9, errorText: 'uninstall denied'});
        if (eof) proc.complete();
        await vi.advanceTimersByTimeAsync(5_000);
        await result;
        expect(outcome.error).toBeInstanceOf(LunaResponseError);
        expect(outcome.error).toMatchObject({errorCode: -9, message: expect.stringContaining('uninstall denied')});
        expect(load).not.toHaveBeenCalled();
    });

    it.each([-3, -5])('preserves structured appinstalld failure %s', async errorCode => {
        const {outcome, result} = await start();
        message({returnValue: false, details: {state: 'FAILED', reason: 'FAILED_IPKG_INSTALL', errorCode}});
        await vi.advanceTimersByTimeAsync(5_000);
        await result;
        if (errorCode === -5) expect(outcome.error).toBeInstanceOf(InstallError);
        else expect(outcome.error).toMatchObject({message: '-3: FAILED_IPKG_INSTALL'});
        expect(load).not.toHaveBeenCalled();
    });

    it('preserves stream errors without refreshing apps', async () => {
        const {outcome, result} = await start();
        const error = new Error('SSH disconnected');
        proc.error(error);
        await result;
        expect(outcome.error).toBe(error);
        expect(load).not.toHaveBeenCalled();
    });

    it('preserves the uninstall error when interrupt delivery also fails', async () => {
        vi.mocked(proc.write).mockRejectedValue(new Error('interrupt failed'));
        const {outcome, result} = await start();
        message({returnValue: false, errorText: 'original uninstall failure'});
        await result;
        expect(outcome.error).toBeInstanceOf(LunaResponseError);
        expect(outcome.error).toMatchObject({message: expect.stringContaining('original uninstall failure')});
        expect(load).not.toHaveBeenCalled();
    });
});
