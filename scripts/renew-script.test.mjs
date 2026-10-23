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
            TEST_SSH_TOKEN: 'TestSessionToken123',
            TEST_CURL_BODY: '{"result":"success"}',
        };
        writeFileSync(join(bin, 'ssh'), `#!/bin/sh
printf '%s\\n' "$*" >>"$TEST_ROOT/ssh.log"
key=''
while [ "$#" -gt 0 ]; do
    if [ "$1" = '-i' ]; then key=$2; break; fi
    shift
done
[ -f "$key" ] || exit 2
case "$(ls -ld "$key")" in -rw-------*) ;; *) exit 2 ;; esac
if [ "$TEST_REQUIRE_DECRYPTED_KEY" = 1 ]; then
    ssh-keygen -y -P '' -f "$key" >/dev/null 2>&1 || exit 2
fi
if [ "$TEST_TERMINATE_PARENT" = 1 ]; then kill -TERM "$PPID"; exit 1; fi
[ -n "$TEST_SSH_TOKEN" ] || exit "\${TEST_SSH_STATUS:-1}"
printf '%s' "$TEST_SSH_TOKEN"
exit "\${TEST_SSH_STATUS:-0}"
`, {mode: 0o755});
        writeFileSync(join(bin, 'ssh-keygen'), `#!/bin/sh
printf called >"$TEST_ROOT/keygen.log"
exit "\${TEST_KEYGEN_STATUS:-0}"
`, {mode: 0o755});
        writeFileSync(join(bin, 'curl'), `#!/bin/sh
printf '%s\\n' "$*" >>"$TEST_ROOT/curl.log"
if [ "$TEST_CURL_STATUS" = 28 ]; then echo 'curl: (28) Operation timed out' >&2; exit 28; fi
if [ "$TEST_HTTP_STATUS" = 500 ]; then
    case " $* " in *' --fail '*) echo 'curl: (22) HTTP error 500' >&2; exit 22 ;; esac
fi
printf '%s\\n' "$TEST_CURL_BODY"
`, {mode: 0o755});
        script = join(root, 'renew.sh');
        render();
    });

    afterEach(() => rmSync(root, {recursive: true, force: true}));

    function render(device = {}, keyContent = 'test-private-key') {
        writeFileSync(script, Mustache.render(template, {
            device: {name: 'living room', host: 'tv.invalid', port: 9922, username: 'prisoner', passphrase: '', ...device},
            keyContent,
        }, undefined, {escape: value => value}));
    }

    function cachePath() {
        return join(env.XDG_STATE_HOME, 'webos-dev-manager/webos_devmode_token_living room.txt');
    }

    function run(overrides = {}) {
        const result = spawnSync('/bin/sh', [script], {env: {...env, ...overrides}, encoding: 'utf8', timeout: 10_000});
        assert.ifError(result.error);
        assert.deepEqual(readdirSync(env.TMPDIR), [], 'temporary private keys must be removed');
        return result;
    }

    function assertRenewed(result) {
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /"result":"success"/);
        assert.match(readFileSync(join(root, 'curl.log'), 'utf8'), /sessionToken=TestSessionToken123/);
    }

    it('persists a private cache in XDG state and renews offline after temporary cleanup', () => {
        assertRenewed(run());
        const directory = join(env.XDG_STATE_HOME, 'webos-dev-manager');
        const cache = join(directory, 'webos_devmode_token_living room.txt');
        assert.equal(readFileSync(cache, 'utf8'), 'TestSessionToken123\n');
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
            assert.equal(readFileSync(cache, 'utf8'), 'TestSessionToken123\n');
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
    it('uses noninteractive SSH', () => {
        assertRenewed(run());
        const args = readFileSync(join(root, 'ssh.log'), 'utf8');
        assert.match(args, /(?:^| )-n(?: |$)/);
        assert.match(args, /BatchMode=yes/);
    });

    it('propagates curl transport timeout status', () => {
        const result = run({TEST_CURL_STATUS: '28'});
        assert.equal(result.status, 28);
        assert.match(result.stderr, /curl exit 28/);
        assert.equal(result.stdout, '');
    });

    it('treats HTTP 500 as a curl failure', () => {
        const result = run({TEST_HTTP_STATUS: '500'});
        assert.equal(result.status, 22);
        assert.match(result.stderr, /curl exit 22/);
        assert.equal(result.stdout, '');
    });

    for (const [name, body] of [
        ['empty', ''], ['malformed', '{broken'], ['rejected', '{"result":"failure"}'],
        ['missing result', '{}'], ['non-object', '[{"result":"success"}]'],
        ['concatenated objects', '{"result":"success"}{"result":"success"}'],
    ]) {
        it(`rejects a ${name} renewal response`, () => {
            const result = run({TEST_CURL_BODY: body});
            assert.equal(result.status, 1);
            assert.match(result.stderr, /invalid or unsuccessful JSON response/);
            assert.equal(result.stdout, '');
        });
    }

    it('does not cache or use stdout from failed SSH', () => {
        assertRenewed(run());
        const result = run({TEST_SSH_TOKEN: 'UntrustedStdout456', TEST_SSH_STATUS: '1'});
        assertRenewed(result);
        assert.equal(readFileSync(cachePath(), 'utf8'), 'TestSessionToken123\n');
        assert.doesNotMatch(readFileSync(join(root, 'curl.log'), 'utf8'), /UntrustedStdout456/);
        assert.doesNotMatch(result.stdout + result.stderr, /UntrustedStdout456|test-private-key/);
    });

    for (const token of ['invalid-token', 'token&extra=1', 'token space', 'token\nsecondline', 'éToken']) {
        it(`preserves a valid cache when SSH returns invalid token ${JSON.stringify(token)}`, () => {
            assertRenewed(run());
            const result = run({TEST_SSH_TOKEN: token});
            assertRenewed(result);
            assert.equal(readFileSync(cachePath(), 'utf8'), 'TestSessionToken123\n');
            assert.doesNotMatch(result.stdout + result.stderr, new RegExp(token));
        });
    }

    it('rejects an invalid online token without a cache', () => {
        const result = run({TEST_SSH_TOKEN: 'invalid&token=1'});
        assert.equal(result.status, 1);
        assert.equal(readdirSync(root).includes('curl.log'), false);
        assert.equal(readdirSync(root).includes('persistent state'), false);
    });

    for (const token of ['', 'invalid-token', 'token\nsecondline']) {
        it(`rejects invalid cached token ${JSON.stringify(token)}`, () => {
            mkdirSync(join(env.XDG_STATE_HOME, 'webos-dev-manager'), {recursive: true});
            writeFileSync(cachePath(), token);
            const result = run({TEST_SSH_TOKEN: ''});
            assert.equal(result.status, 1);
            assert.equal(readdirSync(root).includes('curl.log'), false);
            assert.match(result.stderr, /cache is unreadable or invalid/);
        });
    }

    it('checks encrypted-key conversion and removes private temporary files on failure', () => {
        render({passphrase: 'saved-passphrase'});
        const result = run({TEST_KEYGEN_STATUS: '1'});
        assert.equal(result.status, 1);
        assert.match(result.stderr, /Unable to decrypt SSH private key/);
        assert.equal(readdirSync(root).includes('ssh.log'), false);
        assert.equal(readdirSync(root).includes('curl.log'), false);
        assert.doesNotMatch(result.stdout + result.stderr, /saved-passphrase|test-private-key/);
    });

    it('removes temporary private keys when terminated during SSH', () => {
        const result = run({TEST_TERMINATE_PARENT: '1'});
        assert.equal(result.status, 1);
        assert.equal(readdirSync(root).includes('curl.log'), false);
    });

    it('fails with an actionable prerequisite diagnostic when jq is missing', () => {
        const result = run({PATH: join(root, 'bin')});
        assert.equal(result.status, 1);
        assert.match(result.stderr, /jq is required.*install jq/);
        assert.equal(readdirSync(root).includes('ssh.log'), false);
    });

    it('converts a real encrypted private key without prompting', () => {
        rmSync(join(root, 'bin/ssh-keygen'));
        const keyPath = join(root, 'encrypted-key');
        const generated = spawnSync('ssh-keygen', ['-t', 'rsa', '-b', '2048', '-N', 'fixture-passphrase', '-f', keyPath, '-C', 'renewal-fixture'],
            {encoding: 'utf8', timeout: 10_000});
        assert.ifError(generated.error);
        assert.equal(generated.status, 0, generated.stderr);
        render({passphrase: 'fixture-passphrase'}, readFileSync(keyPath, 'utf8').trim());
        assertRenewed(run({TEST_REQUIRE_DECRYPTED_KEY: '1'}));
    });

});
