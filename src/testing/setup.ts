import {afterEach, beforeEach} from 'vitest';

import {mockBackend, resetBackend} from './tauri-mock';

// HomeComponent reads flex-direction through the CSS Typed OM, which jsdom does
// not implement — without this, every spec that renders the shell dies in
// ngOnInit. Backed by getComputedStyle so the value is still real.
if (!('computedStyleMap' in Element.prototype)) {
    const g = globalThis as any;
    g.CSSKeywordValue ??= class CSSKeywordValue {
        constructor(public value: string) {
        }
    };
    (Element.prototype as any).computedStyleMap = function (this: Element) {
        const style = getComputedStyle(this);
        return {get: (property: string) => new g.CSSKeywordValue(style.getPropertyValue(property))};
    };
}

/**
 * Wired in as the unit-test builder's `setupFiles`, so these hooks wrap *every*
 * spec in the headless suite.
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
