import {TestBed} from '@angular/core/testing';
import {emit} from '@tauri-apps/api/event';
import {vi} from 'vitest';
import {firstValueFrom} from 'rxjs';
import {filter} from 'rxjs/operators';

import {DeviceManagerService} from './device-manager.service';
import {BackendError} from './backend-client';
import {LunaResponseError, LunaServiceNotFoundError, RemoteLunaService} from './remote-luna.service';
import {Device} from '../../types';
import {backendError, mockBackend, resetBackend} from '../../../testing/tauri-mock';

describe('DeviceManagerService', () => {
    const device = <Device>{
        name: 'test',
        host: '192.168.1.1',
        port: 22,
        username: 'root',
        profile: 'ose',
        privateKey: {openSsh: 'id_rsa'},
    };

    afterEach(() => resetBackend());

    it('resolves list() from the backend', async () => {
        mockBackend({'device-manager/list': () => [device]});
        const service = TestBed.inject(DeviceManagerService);
        await expect(service.list()).resolves.toEqual([device]);
    });

    it('pushes devicesUpdated events into devices$', async () => {
        // Mock first: the constructor subscribes via listen(), so a service built
        // before mockBackend() would attach its handler to the real IPC bridge.
        mockBackend({});
        const service = TestBed.inject(DeviceManagerService);
        const updated = firstValueFrom(service.devices$.pipe(filter(Boolean)));

        await emit('device-manager/devicesUpdated', [device]);

        expect(await updated).toEqual([device]);
    });

    it('maps a backend rejection to BackendError', async () => {
        mockBackend({
            'device-manager/list': () => {
                throw backendError('Timeout');
            },
        });
        const service = TestBed.inject(DeviceManagerService);

        await expect(service.list()).rejects.toBeDefined();
        const error = await service.list().catch(e => e);
        expect(BackendError.isCompatible(error)).toBe(true);
        expect(error.reason).toBe('Timeout');
        expect(error.call).toBe('device-manager/list');
    });

    it('fails loudly when a command has no mock', async () => {
        mockBackend({});
        const service = TestBed.inject(DeviceManagerService);
        await expect(service.list()).rejects.toThrow(/No mock for backend call/);
    });

    describe('takeScreenshot', () => {
        const captureUri = 'luna://com.webos.service.capture/executeOneShot';
        const legacyUri = 'luna://com.webos.service.tv.capture/executeOneShot';
        const compositorUri = 'luna://com.webos.surfacemanager/captureCompositorOutput';
        const outOfMemory = new LunaResponseError({
            returnValue: false, errorCode: 'ERROR_07', errorText: 'Cannot allocate memory'
        });

        function setup(responses: Record<string, () => unknown>) {
            const call = vi.fn(async (_device: unknown, uri: string, _param: Record<string, unknown>) => {
                const respond = responses[uri];
                if (!respond) {
                    throw new Error(`Unexpected luna call ${uri}`);
                }
                return respond();
            });
            mockBackend({});
            TestBed.configureTestingModule({providers: [{provide: RemoteLunaService, useValue: {call}}]});
            return {service: TestBed.inject(DeviceManagerService), call};
        }

        function calledUris(call: ReturnType<typeof setup>['call']): string[] {
            return call.mock.calls.map(([, uri]) => uri);
        }

        it('captures with the capture service', async () => {
            const {service, call} = setup({[captureUri]: () => ({returnValue: true})});

            const path = await service.takeScreenshot(device);

            expect(calledUris(call)).toEqual([captureUri]);
            expect(call.mock.calls[0][2]).toEqual({path, method: 'DISPLAY', format: 'PNG'});
        });

        it('captures the compositor output when the capture service fails', async () => {
            const {service, call} = setup({
                [captureUri]: () => {
                    throw outOfMemory;
                },
                [compositorUri]: () => ({returnValue: true}),
            });

            const path = await service.takeScreenshot(device);

            expect(calledUris(call)).toEqual([captureUri, compositorUri]);
            expect(call.mock.calls[1][2]).toEqual({output: path, format: 'PNG'});
        });

        it('captures the compositor output when the legacy capture service fails', async () => {
            const {service, call} = setup({
                [captureUri]: () => {
                    throw new LunaServiceNotFoundError({
                        returnValue: false, errorText: `Service does not exist: com.webos.service.capture.`
                    });
                },
                [legacyUri]: () => {
                    throw outOfMemory;
                },
                [compositorUri]: () => ({returnValue: true}),
            });

            await service.takeScreenshot(device, 'GRAPHIC');

            expect(calledUris(call)).toEqual([captureUri, legacyUri, compositorUri]);
        });

        it('does not use the compositor output for a video capture', async () => {
            const {service, call} = setup({
                [captureUri]: () => {
                    throw outOfMemory;
                },
            });

            await expect(service.takeScreenshot(device, 'VIDEO')).rejects.toBe(outOfMemory);
            expect(calledUris(call)).toEqual([captureUri]);
        });

        it('reports the capture service error when the compositor capture also fails', async () => {
            const {service} = setup({
                [captureUri]: () => {
                    throw outOfMemory;
                },
                [compositorUri]: () => {
                    throw new LunaResponseError({returnValue: false, errorText: 'Denied'});
                },
            });
            vi.spyOn(console, 'warn').mockImplementation(() => undefined);

            await expect(service.takeScreenshot(device)).rejects.toBe(outOfMemory);
        });
    });
});
