import {NgZone} from '@angular/core';
import {emit, listen} from '@tauri-apps/api/event';
import {vi} from 'vitest';
import {EventChannel} from '../event-channel';
import {RemoteFileService} from './remote-file.service';
import {RemoteCommandService} from './remote-command.service';
import {BackendError} from './backend-client';
import {Device} from '../../types';
import {mockBackend} from '../../../testing/tauri-mock';

const token = 'ipk-server-test';
const device = {name: 'test-tv', host: '192.168.1.2'} as Device;
function outcome<T>(promise: Promise<T>) {
    return promise.then(value => ({value, error: undefined}), error => ({value: undefined, error}));
}

describe('RemoteFileService IPK server lifecycle', () => {
    let service: RemoteFileService;
    beforeEach(() => {
        vi.useFakeTimers();
        mockBackend({'remote-file/serve': () => token});
        service = new RemoteFileService({run: (fn: () => void) => fn()} as NgZone, {} as RemoteCommandService);
    });
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    async function readyServer() {
        await listen(`${token}:tx`, () => { void emit(`${token}:rx`, {host: 'http://127.0.0.1:12345/'}); });
        return service.serveLocal(device, '/local/app.ipk');
    }

    it('receives readiness emitted before the start acknowledgment resolves', async () => {
        const internals = (window as any).__TAURI_INTERNALS__ as {invoke: (cmd: string, args: any) => Promise<any>};
        const original = internals.invoke;
        vi.spyOn(internals, 'invoke').mockImplementation((cmd: string, args: any) => {
            if (cmd === 'plugin:event|emit' && args.event === `${token}:tx`) {
                void original(cmd, args);
                return new Promise(() => {});
            }
            return original(cmd, args);
        });
        const instance = await readyServer();
        expect(instance.host).toBe('http://127.0.0.1:12345/');
        await emit(`${token}:closed`, null);
        await expect(instance.interrupt()).resolves.toBeUndefined();
    });

    it('waits for deferred event-listener registration before sending start', async () => {
        let starts = 0;
        await listen(`${token}:tx`, () => {
            starts++;
            void emit(`${token}:rx`, {host: 'http://127.0.0.1:12345/'});
        });
        const internals = (window as any).__TAURI_INTERNALS__ as {invoke: (cmd: string, args: any) => Promise<any>};
        const original = internals.invoke;
        const registrations: (() => void)[] = [];
        vi.spyOn(internals, 'invoke').mockImplementation((cmd: string, args: any) => {
            if (cmd === 'plugin:event|listen' && [`${token}:rx`, `${token}:closed`].includes(args.event)) {
                return new Promise(resolve => registrations.push(() => resolve(original(cmd, args))));
            }
            return original(cmd, args);
        });
        const result = outcome(service.serveLocal(device, '/local/app.ipk'));
        await vi.advanceTimersByTimeAsync(0);
        expect(registrations).toHaveLength(2);
        expect(starts).toBe(0);
        registrations.forEach(register => register());
        const {value, error} = await result;
        expect(error).toBeUndefined();
        expect(value!.host).toBe('http://127.0.0.1:12345/');
        expect(starts).toBe(1);
        await emit(`${token}:closed`, null);
    });

    it('rejects a startup worker error with its original backend details', async () => {
        const release = vi.spyOn(EventChannel.prototype, 'unlisten');
        await listen(`${token}:tx`, () => {
            void emit(`${token}:closed`, {reason: 'Authorization', message: 'SSH session expired'});
        });
        const {error} = await outcome(service.serveLocal(device, '/local/app.ipk'));
        expect(error).toBeInstanceOf(BackendError);
        expect(error.reason).toBe('Authorization');
        expect(error.message).toBe('SSH session expired');
        expect(release).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('reports a normal close before readiness explicitly', async () => {
        await listen(`${token}:tx`, () => { void emit(`${token}:closed`, null); });
        const {error} = await outcome(service.serveLocal(device, '/local/app.ipk'));
        expect(error.message).toContain('closed before becoming ready');
    });

    it('rejects start-event delivery failure and releases listeners', async () => {
        const release = vi.spyOn(EventChannel.prototype, 'unlisten');
        const internals = (window as any).__TAURI_INTERNALS__ as {invoke: (cmd: string, args: any) => Promise<any>};
        const original = internals.invoke;
        const failure = new Error('start delivery failed');
        vi.spyOn(internals, 'invoke').mockImplementation((cmd: string, args: any) => {
            if (cmd === 'plugin:event|emit' && args.event === `${token}:tx`) return Promise.reject(failure);
            return original(cmd, args);
        });
        expect((await outcome(service.serveLocal(device, '/local/app.ipk'))).error).toBe(failure);
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('bounds silent startup and requests remote cancellation', async () => {
        const close = vi.fn(() => { void emit(`${token}:closed`, null); });
        await listen(`${token}:close`, close);
        const result = outcome(service.serveLocal(device, '/local/app.ipk'));
        await vi.advanceTimersByTimeAsync(60_000);
        expect((await result).error.message).toContain('within 60 seconds');
        expect(close).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('shares interruption and completes normally with one listener release', async () => {
        const release = vi.spyOn(EventChannel.prototype, 'unlisten');
        const close = vi.fn(() => { void emit(`${token}:closed`, null); });
        await listen(`${token}:close`, close);
        const instance = await readyServer();
        const first = instance.interrupt();
        expect(instance.interrupt()).toBe(first);
        await first;
        expect(instance.interrupt()).toBe(first);
        expect(close).toHaveBeenCalledTimes(1);
        expect(release).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('retains a server failure that arrives before interruption', async () => {
        const instance = await readyServer();
        await emit(`${token}:closed`, {reason: 'IO', code: 'BrokenPipe', message: 'request write failed'});
        await expect(instance.interrupt()).rejects.toMatchObject({reason: 'IO', message: 'request write failed'});
    });

    it('bounds interruption when the server never closes', async () => {
        const release = vi.spyOn(EventChannel.prototype, 'unlisten');
        const instance = await readyServer();
        const result = outcome(instance.interrupt());
        await vi.advanceTimersByTimeAsync(5_000);
        expect((await result).error.message).toContain('Timed out stopping');
        expect(release).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });
});
