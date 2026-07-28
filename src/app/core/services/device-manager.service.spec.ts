import {TestBed} from '@angular/core/testing';
import {emit} from '@tauri-apps/api/event';
import {firstValueFrom} from 'rxjs';
import {filter} from 'rxjs/operators';

import {DeviceManagerService} from './device-manager.service';
import {BackendError} from './backend-client';
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
});
