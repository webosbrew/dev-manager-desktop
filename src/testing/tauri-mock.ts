import {clearMocks, mockIPC} from '@tauri-apps/api/mocks';

/**
 * A stubbed backend command. Keyed by `<category>/<method>` — the same pair
 * {@link BackendClient.invoke} builds its `plugin:<category>|<method>` name
 * from, so a handler map reads like the Rust command list.
 */
export type CommandHandler = (args: Record<string, any>) => unknown | Promise<unknown>;

export type CommandHandlers = Record<string, CommandHandler>;

/**
 * A rejected backend call. Throw this from a handler to exercise the error
 * mapping in {@link BackendClient} — a plain `Error` bypasses it, because the
 * real backend only ever sends a serialized {@link BackendErrorBody}.
 */
export function backendError(reason: string, extra: Record<string, unknown> = {}): unknown {
    return {reason, ...extra};
}

/**
 * Routes every `invoke` to `handlers` and makes `listen`/`emit` work in-process,
 * so a spec can drive both directions of the IPC boundary without a Tauri window.
 *
 * An unmapped command rejects with a message naming it, rather than resolving to
 * `undefined` — a silent `undefined` surfaces later as an unrelated failure deep
 * in the component under test.
 */
export function mockBackend(handlers: CommandHandlers, platform: 'windows' | 'posix' = 'posix'): void {
    mockIPC(async (cmd, args) => {
        const match = /^plugin:([^|]+)\|(.+)$/.exec(cmd);
        const call = match ? `${match[1]}/${match[2]}` : cmd;
        const handler = handlers[call];
        if (!handler) {
            throw backendError('Message', {message: `No mock for backend call ${call}`});
        }
        return handler((args ?? {}) as Record<string, any>);
    }, {shouldMockEvents: true});

    // `mockIPC` only covers `invoke` and the event plugin. Some plugin values are
    // read synchronously off the internals object instead — `path.sep()` is one,
    // and it throws rather than rejecting, so it has to be seeded here.
    const internals = (window as any).__TAURI_INTERNALS__;
    internals.plugins = {
        ...internals.plugins,
        path: platform === 'windows'
            ? {sep: '\\', delimiter: ';'}
            : {sep: '/', delimiter: ':'},
    };
}

/**
 * Tears the mock down. Call from `afterEach` so mocks never leak between specs.
 *
 * `clearMocks` removes `__TAURI_INTERNALS__` outright, so a call still in flight
 * when a spec ends dies with `invoke is not a function` — noise in the report that
 * points at the harness rather than at anything real. Leaving a rejecting stub
 * behind turns those stragglers into a quiet, named rejection instead.
 */
export function resetBackend(): void {
    clearMocks();
    mockIPC(async cmd => {
        // Stream cleanup is fire-and-forget on the app side — plugin-http cancels a
        // response body it never finished reading. Rejecting those would report a
        // failure for something no caller is waiting on.
        if (cmd.startsWith('plugin:http|fetch_cancel')) {
            return null;
        }
        throw backendError('Message', {message: `Backend mock torn down before ${cmd} completed`});
    });
}
