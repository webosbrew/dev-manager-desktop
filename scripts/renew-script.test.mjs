import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {afterEach, beforeEach, describe, it} from 'node:test';
import Mustache from 'mustache';
import ts from 'typescript';

// Apply the actual TypeScript template's string escapes without another loader.
const source = readFileSync(new URL('../src/app/info/renew-script/renew-script.sh.ts', import.meta.url), 'utf8');
const {default: template} = await import(`data:text/javascript,${encodeURIComponent(ts.transpile(source))}`);

describe('generated renewal script', {skip: process.platform === 'win32' ? 'Run in a POSIX shell (for example WSL)' : false}, () => {
    let root;
    let env;
    let script;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'renew script test '));
        const bin = join(root, 'bin');
        mkdirSync(bin);
        mkdirSync(join(root, 'temporary keys'));
        env = {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            HOME: join(root, 'user home'),
            XDG_STATE_HOME: join(root, 'persistent state'),
            TMPDIR: join(root, 'temporary keys'),
            TEST_ROOT: root,
            TEST_SSH_TOKEN: 'test-session-token',
        };
        writeFileSync(join(bin, 'ssh'), `#!/bin/sh
[ "$1" = '-i' ] && [ -f "$2" ] || exit 2
case "$(ls -ld "$2")" in -rw-------*) ;; *) exit 2 ;; esac
[ -n "$TEST_SSH_TOKEN" ] || exit 1
printf '%s' "$TEST_SSH_TOKEN"
`, {mode: 0o755});
        writeFileSync(join(bin, 'curl'), `#!/bin/sh
printf '%s\\n' "$*" >>"$TEST_ROOT/curl.log"
printf '%s\\n' '{"result":"success"}'
`, {mode: 0o755});
        script = join(root, 'renew.sh');
        writeFileSync(script, Mustache.render(template, {
            device: {name: 'living room', host: 'tv.invalid', port: 9922, username: 'prisoner', passphrase: ''},
            keyContent: 'test-private-key',
        }, undefined, {escape: value => value}));
    });

    afterEach(() => rmSync(root, {recursive: true, force: true}));

    function run(overrides = {}) {
        const result = spawnSync('sh', [script], {env: {...env, ...overrides}, encoding: 'utf8'});
        assert.ifError(result.error);
        assert.deepEqual(readdirSync(env.TMPDIR), [], 'temporary private keys must be removed');
        return result;
    }

    function assertRenewed(result) {
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /"result":"success"/);
        assert.match(readFileSync(join(root, 'curl.log'), 'utf8'), /sessionToken=test-session-token/);
    }

    it('persists a private cache in XDG state and renews offline after temporary cleanup', () => {
        assertRenewed(run());
        const directory = join(env.XDG_STATE_HOME, 'webos-dev-manager');
        const cache = join(directory, 'webos_devmode_token_living room.txt');
        assert.equal(readFileSync(cache, 'utf8'), 'test-session-token\n');
        assert.equal(statSync(directory).mode & 0o777, 0o700);
        assert.equal(statSync(cache).mode & 0o777, 0o600);

        rmSync(env.TMPDIR, {recursive: true});
        mkdirSync(env.TMPDIR);
        assertRenewed(run({TEST_SSH_TOKEN: ''}));
        assert.equal(readFileSync(join(root, 'curl.log'), 'utf8').trim().split('\n').length, 2);
    });

    for (const stateHome of ['', 'relative-state']) {
        it(`uses HOME/.local/state when XDG_STATE_HOME is ${stateHome ? 'relative' : 'unset'}`, () => {
            assertRenewed(run({XDG_STATE_HOME: stateHome}));
            const cache = join(env.HOME, '.local/state/webos-dev-manager/webos_devmode_token_living room.txt');
            assert.equal(readFileSync(cache, 'utf8'), 'test-session-token\n');
            assertRenewed(run({XDG_STATE_HOME: stateHome, TEST_SSH_TOKEN: ''}));
        });
    }

    it('fails clearly without calling curl when the TV is offline and no cache exists', () => {
        const result = run({TEST_SSH_TOKEN: ''});
        assert.equal(result.status, 1);
        assert.match(result.stderr, /Unable to get token from TV or persistent cache/);
        assert.equal(readdirSync(root).includes('curl.log'), false);
    });

    it('still renews online when the cache directory cannot be created', () => {
        writeFileSync(env.XDG_STATE_HOME, 'not a directory');
        const result = run();
        assertRenewed(result);
        assert.match(result.stderr, /Unable to create token cache directory/);
    });

    it('still renews online when the token cache cannot be written', () => {
        mkdirSync(join(env.XDG_STATE_HOME, 'webos-dev-manager/webos_devmode_token_living room.txt'), {recursive: true});
        const result = run();
        assertRenewed(result);
        assert.match(result.stderr, /Unable to save token cache/);
    });
});
