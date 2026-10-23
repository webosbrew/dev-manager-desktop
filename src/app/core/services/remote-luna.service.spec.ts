import {NgZone} from '@angular/core';
import {ReplaySubject} from 'rxjs';
import {vi} from 'vitest';
import {CommandData, CommandSubject} from './remote-command.service';
import {LunaSubscription} from './remote-luna.service';

function command() {
    const proc = new ReplaySubject<CommandData<string>>() as CommandSubject<string>;
    proc.write = vi.fn().mockResolvedValue(undefined);
    return proc;
}

describe('LunaSubscription disposal', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('shares one interrupt/disposal across concurrent and repeated calls', async () => {
        const proc = command();
        const complete = vi.spyOn(proc, 'complete');
        const luna = new LunaSubscription(proc, 'test');
        const first = luna.unsubscribe();
        expect(luna.unsubscribe()).toBe(first);
        await vi.advanceTimersByTimeAsync(5_000);
        await first;
        expect(luna.unsubscribe()).toBe(first);
        expect(proc.write).toHaveBeenCalledTimes(1);
        expect(complete).toHaveBeenCalledTimes(1);
        expect(proc.observed).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('bounds an interrupt write that never settles and releases real IPC listeners', async () => {
        const zone = {run: (fn: () => void) => fn()} as NgZone;
        const proc = new CommandSubject<string>(zone, 'luna-test', 'luna-send-pub -i test', 'utf-8');
        const unlisten = vi.spyOn((window as any).__TAURI_EVENT_PLUGIN_INTERNALS__, 'unregisterListener');
        vi.spyOn(proc, 'write').mockImplementation(() => new Promise(() => {}));
        const luna = new LunaSubscription(proc, 'test');
        const cleanup = luna.unsubscribe();
        await vi.advanceTimersByTimeAsync(5_000);
        await cleanup;
        expect(proc.isStopped).toBe(true);
        expect(unlisten).toHaveBeenCalledTimes(2);
        expect(proc.observed).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('handles process completion during the interrupt without waiting for the deadline', async () => {
        const proc = command();
        vi.mocked(proc.write).mockImplementation(async () => proc.complete());
        const luna = new LunaSubscription(proc, 'test');
        await luna.unsubscribe();
        expect(proc.write).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('finishes on process close even when the interrupt acknowledgment hangs', async () => {
        const proc = command();
        vi.mocked(proc.write).mockImplementation(() => new Promise(() => {}));
        const luna = new LunaSubscription(proc, 'test');
        const cleanup = luna.unsubscribe();
        await vi.advanceTimersByTimeAsync(0);
        proc.complete();
        await cleanup;
        expect(vi.getTimerCount()).toBe(0);
    });

    it('treats interrupt rejection as best effort and still disposes the process', async () => {
        const proc = command();
        vi.mocked(proc.write).mockRejectedValue(new Error('connection lost'));
        const luna = new LunaSubscription(proc, 'test');
        await expect(luna.unsubscribe()).resolves.toBeUndefined();
        expect(proc.isStopped).toBe(true);
        expect(proc.observed).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('does not interrupt a process that already closed', async () => {
        const proc = command();
        proc.complete();
        const luna = new LunaSubscription(proc, 'test');
        await luna.unsubscribe();
        expect(proc.write).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });
});
