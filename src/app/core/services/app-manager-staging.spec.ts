import {Observable, of, Subject} from 'rxjs';
import {Mock, vi} from 'vitest';
import {AppManagerService} from './app-manager.service';
import {RemoteLunaService, LunaResponse} from './remote-luna.service';
import {RemoteCommandService} from './remote-command.service';
import {RemoteFileService} from './remote-file.service';
import {LocalFileService} from './local-file.service';
import {DeviceManagerService} from './device-manager.service';
import {PackageManifest} from './apps-repo.service';
import {Device} from '../../types';
import {mockBackend} from '../../../testing/tauri-mock';

const device = {name: 'test-tv', host: '192.168.1.2'} as Device;
const selectedPath = '/user/app.ipk';
const manifest = {id: 'test.app', ipkUrl: 'https://example.test/app.ipk'} as PackageManifest;
const installed = {returnValue: true, details: {state: 'installed'}};

describe('AppManagerService IPK staging ownership', () => {
    let service: AppManagerService;
    let localFiles: Set<string>;
    let remoteFiles: Set<string>;
    let file: {mkdir: Mock<RemoteFileService['mkdir']>; put: Mock<RemoteFileService['put']>; rm: Mock<RemoteFileService['rm']>};
    let local: {tempPath: Mock<LocalFileService['tempPath']>; remove: Mock<LocalFileService['remove']>};
    let download: Mock<(args: {url: string; filePath: string}) => Promise<void>>;
    let subscribe: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localFiles = new Set([selectedPath]);
        remoteFiles = new Set();
        let sequence = 0;
        local = {
            tempPath: vi.fn(async () => `/tmp/generated-${++sequence}.ipk`),
            remove: vi.fn(async path => { localFiles.delete(path); }),
        };
        file = {
            mkdir: vi.fn().mockResolvedValue(undefined),
            put: vi.fn(async (_device, target, source) => {
                expect(localFiles.has(source)).toBe(true);
                remoteFiles.add(target);
            }),
            rm: vi.fn(async (_device, path) => { remoteFiles.delete(path); }),
        };
        download = vi.fn(async ({filePath}) => { localFiles.add(filePath); });
        mockBackend({'upload/download': ({url, filePath}) => download({url, filePath})});
        subscribe = vi.fn(async (_device, _uri, params) => {
            expect(remoteFiles.has(params.ipkUrl)).toBe(true);
            expect(file.rm).not.toHaveBeenCalled();
            return {asObservable: () => of(installed), unsubscribe: vi.fn().mockResolvedValue(undefined)};
        });
        service = new AppManagerService({subscribe} as unknown as RemoteLunaService, {} as RemoteCommandService,
            file as unknown as RemoteFileService, local as unknown as LocalFileService,
            {getHbChannelConfig: vi.fn().mockRejectedValue(new Error('not installed'))} as unknown as DeviceManagerService);
        vi.spyOn(service, 'load').mockResolvedValue([]);
    });
    afterEach(() => vi.restoreAllMocks());

    function install(input: 'URL' | 'selected') {
        return input === 'URL' ? service.installByManifest(device, manifest) : service.installByPath(device, selectedPath);
    }

    it.each([false, true])('cleans a partial download and preserves its error (cleanup fails=%s)', async cleanupFails => {
        const original = new Error('download failed');
        download.mockImplementation(async ({filePath}) => { localFiles.add(filePath); throw original; });
        if (cleanupFails) local.remove.mockRejectedValue(new Error('local cleanup failed'));

        await expect(install('URL')).rejects.toBe(original);

        expect(local.remove).toHaveBeenCalledExactlyOnceWith('/tmp/generated-1.ipk');
        if (!cleanupFails) expect(localFiles).toEqual(new Set([selectedPath]));
        expect(file.put).not.toHaveBeenCalled();
        expect(file.rm).not.toHaveBeenCalled();
        expect(subscribe).not.toHaveBeenCalled();
    });

    for (const input of ['URL', 'selected'] as const) {
        it.each([false, true])(`cleans a failed ${input} upload without masking its error (cleanup fails=%s)`, async cleanupFails => {
            const original = new Error('upload failed');
            file.put.mockImplementation(async (_device, target) => { remoteFiles.add(target); throw original; });
            if (cleanupFails) {
                file.rm.mockRejectedValue(new Error('remote cleanup failed'));
                local.remove.mockRejectedValue(new Error('local cleanup failed'));
            }

            await expect(install(input)).rejects.toBe(original);

            const target = file.put.mock.calls[0][1];
            expect(target).toMatch(/^\/media\/developer\/temp\/devman_dl_.*\.ipk$/);
            expect(file.rm).toHaveBeenCalledExactlyOnceWith(device, target, false);
            if (!cleanupFails) expect(remoteFiles.size).toBe(0);
            expect(localFiles.has(selectedPath)).toBe(true);
            if (input === 'URL') expect(local.remove).toHaveBeenCalledExactlyOnceWith('/tmp/generated-1.ipk');
            else expect(local.remove).not.toHaveBeenCalled();
            expect(subscribe).not.toHaveBeenCalled();
        });

        it.each([false, true])(`hands a staged ${input} IPK to the installer before outer cleanup (install fails=%s)`, async installFails => {
            subscribe.mockImplementation(async (_device, _uri, params) => {
                expect(remoteFiles.has(params.ipkUrl)).toBe(true);
                expect(file.rm).not.toHaveBeenCalled();
                return {
                    asObservable: (): Observable<LunaResponse> => of(installFails ?
                        {returnValue: false, errorText: 'installation failed'} : installed),
                    unsubscribe: vi.fn().mockResolvedValue(undefined),
                };
            });

            const result = install(input);
            if (installFails) await expect(result).rejects.toThrow('installation failed');
            else await expect(result).resolves.toBeUndefined();

            expect(subscribe).toHaveBeenCalledTimes(1);
            expect(file.rm).toHaveBeenCalledExactlyOnceWith(device, file.put.mock.calls[0][1], false);
            expect(remoteFiles.size).toBe(0);
            expect(localFiles).toEqual(new Set([selectedPath]));
            if (input === 'URL') expect(local.remove).toHaveBeenCalledExactlyOnceWith('/tmp/generated-1.ipk');
            else expect(local.remove).not.toHaveBeenCalled();
        });
    }

    it('isolates concurrent staging paths so a failed transfer cannot delete another installation', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(42);
        const otherSource = '/user/other.ipk';
        localFiles.add(otherSource);
        const responses = new Subject<LunaResponse>();
        let started!: () => void;
        const installing = new Promise<void>(resolve => { started = resolve; });
        subscribe.mockImplementation(async (_device, _uri, params) => {
            expect(remoteFiles.has(params.ipkUrl)).toBe(true);
            started();
            return {asObservable: () => responses, unsubscribe: vi.fn().mockResolvedValue(undefined)};
        });
        file.put.mockImplementation(async (_device, target, source) => {
            remoteFiles.add(target);
            if (source === otherSource) throw new Error('second upload failed');
        });
        const first = service.installByPath(device, selectedPath);
        await installing;
        try {
            await expect(service.installByPath(device, otherSource)).rejects.toThrow('second upload failed');
            const targets = file.put.mock.calls.map(call => call[1]);
            expect(new Set(targets).size).toBe(2);
            expect(remoteFiles.has(targets[0])).toBe(true);
            expect(remoteFiles.has(targets[1])).toBe(false);
        } finally {
            responses.next(installed);
            await first;
        }
        expect(remoteFiles.size).toBe(0);
        expect(localFiles).toEqual(new Set([selectedPath, otherSource]));
    });
});
