import {mockBackend, resetBackend} from './tauri-mock';

/**
 * Root-level hooks: registered outside any `describe`, so they wrap *every* spec
 * in the headless suite.
 *
 * Without this, a component that only incidentally touches Tauri — `path.sep()`
 * during form setup, say — dies with `Cannot read properties of undefined`
 * instead of a readable failure, because outside a Tauri window there is no
 * `__TAURI_INTERNALS__` at all.
 *
 * The default handler map is empty on purpose: an un-mocked command rejects and
 * names itself. Specs that need a command install their own map with
 * `mockBackend({...})`, which runs after this hook and replaces it wholesale.
 */
beforeEach(() => mockBackend({}));

afterEach(() => resetBackend());
