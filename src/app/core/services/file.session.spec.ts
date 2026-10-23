import {Mock, vi} from 'vitest';
import {ProgressCallback} from './progress-callback';
import {FileSessionImpl} from './file.session';
import {RemoteCommandService} from './remote-command.service';
import {RemoteFileService} from './remote-file.service';
import {Device} from '../../types';

const device = {name: 'test-tv', host: '192.168.1.2'} as Device;
const first = '/local/first.txt';
const second = '/local/second.txt';

describe('FileSessionImpl uploadBatch', () => {
    let put: Mock<RemoteFileService['put']>;
    let session: FileSessionImpl;
    let fileCb: Mock<(name: string, index: number, total: number) => void>;
    let progressCb: Mock<ProgressCallback>;
    const unexpectedAttempt = new Error('Unexpected extra upload attempt');

    beforeEach(() => {
        put = vi.fn<RemoteFileService['put']>().mockRejectedValue(unexpectedAttempt);
        session = new FileSessionImpl({} as RemoteCommandService,
            {put} as unknown as RemoteFileService, device);
        fileCb = vi.fn();
        progressCb = vi.fn();
    });

    it('stops retrying after success and advances to the next file', async () => {
        const failure = new Error('temporary failure');
        put.mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined)
            .mockImplementationOnce(async (_device, _target, source) => {
                if (source !== second) throw unexpectedAttempt;
            });
        const failCb = vi.fn(async (_name, error) => {
            // Bound a regression: an unexpected third attempt on first.txt rejects.
            if (error !== failure) throw error;
            return true;
        });

        await expect(session.uploadBatch([first, second], '/target', fileCb, progressCb, failCb)).resolves.toBeUndefined();

        expect(put.mock.calls).toEqual([
            [device, '/target/first.txt', first, progressCb],
            [device, '/target/first.txt', first, progressCb],
            [device, '/target/second.txt', second, progressCb],
        ]);
        expect(failCb).toHaveBeenCalledExactlyOnceWith('first.txt', failure);
        expect(fileCb.mock.calls).toEqual([['first.txt', 0, 2], ['second.txt', 1, 2]]);
    });

    it('skips a failed file when retry is declined and proceeds to the next file', async () => {
        const failure = new Error('upload failed');
        put.mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined);
        const failCb = vi.fn().mockResolvedValue(false);

        await session.uploadBatch([first, second], '/target', fileCb, progressCb, failCb);

        expect(put).toHaveBeenCalledTimes(2);
        expect(put).toHaveBeenLastCalledWith(device, '/target/second.txt', second, progressCb);
        expect(failCb).toHaveBeenCalledExactlyOnceWith('first.txt', failure);
    });

    it('preserves the original upload error when the callback aborts', async () => {
        const failure = new Error('upload failed');
        put.mockRejectedValueOnce(failure);
        const failCb = vi.fn(async (_name, error) => { throw error; });

        await expect(session.uploadBatch([first, second], '/target', fileCb, progressCb, failCb)).rejects.toBe(failure);

        expect(put).toHaveBeenCalledTimes(1);
        expect(fileCb).toHaveBeenCalledExactlyOnceWith('first.txt', 0, 2);
    });

    it('allows repeated failed retries but ends the file after eventual success', async () => {
        const failures = [new Error('first failure'), new Error('second failure')];
        put.mockRejectedValueOnce(failures[0]).mockRejectedValueOnce(failures[1]).mockResolvedValueOnce(undefined);
        const failCb = vi.fn(async (_name, error) => {
            if (!failures.includes(error)) throw error;
            return true;
        });

        await expect(session.uploadBatch([first], '/target', fileCb, progressCb, failCb)).resolves.toBeUndefined();

        expect(put).toHaveBeenCalledTimes(3);
        expect(failCb.mock.calls).toEqual([['first.txt', failures[0]], ['first.txt', failures[1]]]);
        expect(fileCb).toHaveBeenCalledExactlyOnceWith('first.txt', 0, 1);
    });

    it('uploads successful files once without invoking the failure callback', async () => {
        put.mockResolvedValue(undefined);
        const failCb = vi.fn();

        await session.uploadBatch([first, second], '/target', fileCb, progressCb, failCb);

        expect(put).toHaveBeenCalledTimes(2);
        expect(failCb).not.toHaveBeenCalled();
        expect(fileCb.mock.calls).toEqual([['first.txt', 0, 2], ['second.txt', 1, 2]]);
    });
});
