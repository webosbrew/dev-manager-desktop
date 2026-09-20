import Mustache from 'mustache';

import renewScriptTemplate from './renew-script.sh';

describe('Developer Mode renewal script', () => {
    const script = Mustache.render(renewScriptTemplate, {
        device: {
            name: 'living-room',
            host: '192.168.1.10',
            port: 9922,
            username: 'prisoner',
            passphrase: 'ABC123',
        },
        keyContent: 'PRIVATE KEY',
    }, undefined, {
        escape: (value) => value,
    });

    it('renews by launching the Developer Mode app on the TV', () => {
        expect(script).toContain('luna://com.webos.applicationManager/launch');
        expect(script).toContain('"id":"com.palmdts.devmode"');
        expect(script).toContain('"extend":true');
        expect(script).toContain('-o BatchMode=yes');
    });

    it('does not use the obsolete token renewal endpoint', () => {
        expect(script).not.toContain('ResetDevModeSession.dev');
        expect(script).not.toContain('/var/luna/preferences/devmode_enabled');
        expect(script).not.toContain('SESSION_TOKEN');
    });
});
