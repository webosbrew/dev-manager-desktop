import {ReplaySubject} from 'rxjs';
import {vi} from 'vitest';
import {AppManagerService, InstallError} from './app-manager.service';
import {CommandData, CommandSubject, RemoteCommandService} from './remote-command.service';
import {LunaResponseError, LunaSubscription, RemoteLunaService} from './remote-luna.service';
import {RemoteFileService} from './remote-file.service';
import {LocalFileService} from './local-file.service';
import {DeviceManagerService} from './device-manager.service';
import {Device} from '../../types';
import {PackageManifest} from './apps-repo.service';
import {APP_ID_HBCHANNEL} from '../../shared/constants';

const device = {name: 'test-tv', host: '192.168.1.2', username: 'prisoner'} as Device;
const idle = 10 * 60 * 1_000;

describe('AppManagerService developer installation', () => {
    let proc: CommandSubject<string>;
    let luna: {subscribe: ReturnType<typeof vi.fn>};
    let file: {mkdir: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; rm: ReturnType<typeof vi.fn>};
    let service: AppManagerService;
    let deviceManager: {getHbChannelConfig: ReturnType<typeof vi.fn>};

    beforeEach(() => {
        vi.useFakeTimers();
        proc = new ReplaySubject<CommandData<string>>() as CommandSubject<string>;
        proc.write = vi.fn().mockResolvedValue(undefined);
        luna = {subscribe: vi.fn().mockResolvedValue(new LunaSubscription(proc, 'test'))};
        file = {mkdir: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined),
            rm: vi.fn().mockResolvedValue(undefined)};
        deviceManager = {getHbChannelConfig: vi.fn().mockRejectedValue(new Error('not installed'))};
        service = new AppManagerService(luna as unknown as RemoteLunaService, {} as RemoteCommandService,
            file as unknown as RemoteFileService, {} as LocalFileService,
            deviceManager as unknown as DeviceManagerService);
        vi.spyOn(service, 'load').mockResolvedValue([]);
    });
    afterEach(() => vi.useRealTimers());

    async function start() {
        // Attach the error handler before advancing fake time to avoid unhandled rejections.
        const result = service.installByPath(device, '/local/app.ipk').then(() => undefined, error => error);
        await vi.advanceTimersByTimeAsync(0);
        expect(luna.subscribe).toHaveBeenCalledOnce();
        return {result};
    }

    function message(payload: object) {
        proc.next({fd: 0, data: JSON.stringify(payload)});
    }

    function expectIpkRemoved() {
        const path = file.put.mock.calls[0][1];
        expect(path).toMatch(/^\/media\/developer\/temp\/devman_dl_.*\.ipk$/);
        expect(file.rm).toHaveBeenCalledExactlyOnceWith(device, path, false);
    }

    it.each([false, true])('preserves a top-level Luna failure when EOF=%s', async eof => {
        const {result} = await start();
        message({returnValue: false, errorCode: -9, errorText: 'Developer Mode session expired'});
        if (eof) proc.complete();
        await vi.advanceTimersByTimeAsync(5_000);
        const error = await result;
        expect(error).toBeInstanceOf(LunaResponseError);
        expect(error.errorCode).toBe(-9);
        expect(error.message).toContain('Developer Mode session expired');
        expectIpkRemoved();
        expect(proc.observed).toBe(false);
    });

    it('reports an EOF before any terminal response', async () => {
        const {result} = await start();
        message({returnValue: true, details: {state: 'installing'}});
        proc.complete();
        expect((await result).message).toContain('closed before the TV reported a result');
        expectIpkRemoved();
    });

    it('times out a silent subscription and removes the remote IPK', async () => {
        const {result} = await start();
        await vi.advanceTimersByTimeAsync(idle + 5_000);
        expect((await result).message).toContain('No installation response from the TV for 10 minutes');
        expectIpkRemoved();
        expect(proc.isStopped).toBe(true);
    });

    it('renews the inactivity window on progress, then times out when progress stops', async () => {
        const {result} = await start();
        for (let i = 0; i < 3; i++) {
            await vi.advanceTimersByTimeAsync(idle - 60_000);
            message({returnValue: true, details: {state: 'installing', progress: i}});
        }
        // More than 10 minutes overall is allowed while responses keep arriving.
        expect(file.rm).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(idle + 5_000);
        expect((await result).message).toContain('No installation response');
        expectIpkRemoved();
    });

    it('returns installed success even if the process never closes', async () => {
        const {result} = await start();
        message({returnValue: true, details: {state: 'installed'}});
        // A later error must not replace the first terminal result.
        message({returnValue: false, errorText: 'late failure'});
        await vi.advanceTimersByTimeAsync(5_000);
        expect(await result).toBeUndefined();
        expect(proc.write).toHaveBeenCalledTimes(1);
        expectIpkRemoved();
    });

    it.each([false, true])('preserves FAILED_IPKG_INSTALL insufficient-space mapping with returnValue=%s', async returnValue => {
        const {result} = await start();
        message({returnValue, details: {state: 'FAILED', reason: 'FAILED_IPKG_INSTALL', errorCode: -5}});
        await vi.advanceTimersByTimeAsync(5_000);
        expect(await result).toBeInstanceOf(InstallError);
        expect((await result).message).toContain('insufficient space');
        expectIpkRemoved();
    });

    it('reports other appinstalld failures without waiting for process close', async () => {
        const {result} = await start();
        message({details: {state: 'FAILED', reason: 'FAILED_IPKG_INSTALL', errorCode: -3}});
        await vi.advanceTimersByTimeAsync(5_000);
        expect((await result).message).toBe('-3: FAILED_IPKG_INSTALL');
        expectIpkRemoved();
    });

    it('does not replace a Luna failure when interrupt and remote IPK cleanup both fail', async () => {
        vi.mocked(proc.write).mockRejectedValue(new Error('interrupt failed'));
        file.rm.mockRejectedValue(new Error('remove failed'));
        const {result} = await start();
        message({returnValue: false, errorCode: -9, errorText: 'original install failure'});
        const error = await result;
        expect(error).toBeInstanceOf(LunaResponseError);
        expect(error.message).toContain('original install failure');
        expectIpkRemoved();
    });
    describe('Homebrew Channel installation', () => {
        async function startHb() {
            deviceManager.getHbChannelConfig.mockResolvedValue({});
            const manifest = {id: APP_ID_HBCHANNEL, ipkUrl: 'https://example.test/app.ipk'} as PackageManifest;
            const result = service.installByManifest(device, manifest).then(() => undefined, error => error);
            await vi.advanceTimersByTimeAsync(0);
            expect(luna.subscribe).toHaveBeenCalledWith(device,
                'luna://org.webosbrew.hbchannel.service/install', expect.anything());
            return {result};
        }

        it.each([{returnValue: true, finished: true}, {returnValue: true, subscribed: false}])(
            'accepts the existing success response %o without waiting for EOF', async response => {
                const {result} = await startHb();
                message(response);
                await vi.advanceTimersByTimeAsync(5_000);
                expect(await result).toBeUndefined();
                expect(file.put).not.toHaveBeenCalled();
            });

        it('preserves the existing insufficient-space error mapping', async () => {
            const {result} = await startHb();
            message({returnValue: false, errorText: '-5: FAILED_IPKG_INSTALL'});
            await vi.advanceTimersByTimeAsync(5_000);
            expect(await result).toBeInstanceOf(InstallError);
            expect((await result).message).toContain('insufficient space');
            expect(file.put).not.toHaveBeenCalled();
        });

        it('bounds a silent Homebrew Channel installation', async () => {
            const {result} = await startHb();
            await vi.advanceTimersByTimeAsync(idle + 5_000);
            expect((await result).message).toContain('No installation response');
            expect(proc.isStopped).toBe(true);
        });
    });

});
