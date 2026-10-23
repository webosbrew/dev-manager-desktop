import {vi} from 'vitest';
import {AppManagerService} from './app-manager.service';
import {RemoteLunaService} from './remote-luna.service';
import {RemoteCommandService} from './remote-command.service';
import {RemoteFileService} from './remote-file.service';
import {LocalFileService} from './local-file.service';
import {DeviceManagerService} from './device-manager.service';
import {Device} from '../../types';

describe('AppManagerService IPK server cleanup', () => {
    it.each([false, true])('preserves installation outcome when server interruption fails (success=%s)', async success => {
        const original = new Error('original installation error');
        const interrupt = vi.fn().mockRejectedValue(new Error('server cleanup failed'));
        const service = new AppManagerService({} as RemoteLunaService, {} as RemoteCommandService,
            {serveLocal: vi.fn().mockResolvedValue({host: 'http://127.0.0.1:12345/', interrupt})} as unknown as RemoteFileService,
            {checksum: vi.fn().mockResolvedValue('sha256')} as unknown as LocalFileService,
            {getHbChannelConfig: vi.fn().mockResolvedValue({})} as unknown as DeviceManagerService);
        vi.spyOn(service, 'load').mockResolvedValue([]);
        const install = vi.spyOn(service as any, 'hbChannelInstall');
        if (success) install.mockResolvedValue(undefined);
        else install.mockRejectedValue(original);
        const result = service.installByPath({name: 'test-tv'} as Device, '/local/app.ipk');
        if (success) await expect(result).resolves.toBeUndefined();
        else await expect(result).rejects.toBe(original);
        expect(interrupt).toHaveBeenCalledTimes(1);
    });
});
