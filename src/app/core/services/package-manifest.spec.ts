import {PackageManifest} from './apps-repo.service';

function hasUpdate(latest: unknown, installed: unknown): boolean | null {
    // Repository and installed-app metadata can violate their declared types at runtime.
    return new PackageManifest({version: latest as string}).hasUpdate(installed as string);
}

const invalidVersions: [string, unknown][] = [
    ['missing', undefined], ['null', null], ['empty', ''], ['incomplete', '1.2'],
    ['unknown', 'unknown'], ['malformed', 'not-a-version'], ['numeric', 123],
    ['boolean', true], ['object', {version: '1.2.3'}], ['array', ['1.2.3']],
    ['five-part legacy', '1.2.3.4.5'], ['empty fourth component', '1.2.3.'],
];

describe('PackageManifest update comparison', () => {
    it.each(invalidVersions)('returns unknown for an invalid installed version (%s)', (_label, installed) => {
        expect(hasUpdate('1.2.3', installed)).toBeNull();
    });

    it.each(invalidVersions)('returns unknown for invalid repository metadata (%s)', (_label, latest) => {
        expect(hasUpdate(latest, '1.2.3')).toBeNull();
    });

    it('retains the missing-installed-version result', () => {
        expect(new PackageManifest({version: '1.2.3'}).hasUpdate()).toBeNull();
    });

    it.each<[string, string, boolean]>([
        ['2.0.0', '1.9.9', true],
        ['1.2.4', '1.2.3', true],
        ['1.2.3', '1.2.3', false],
        ['1.2.2', '1.2.3', false],
        ['1.2.3', '1.2.3-beta.1', true],
        ['1.2.3-beta.1', '1.2.3', false],
        ['1.2.3-beta.10', '1.2.3-beta.2', true],
        ['1.2.3-beta.2.2', '1.2.3-beta.2.1', true],
        ['1.2.3-beta.2.1', '1.2.3-beta.2.2', false],
        ['1.2.3+build.2', '1.2.3+build.1', false],
        ['1.2.3+build.1', '1.2.3+build.2', false],
        ['1.2.3+build.99', '1.2.3', false],
        ['1.2.3-beta.2+build.99', '1.2.3-beta.2+build.1', false],
    ])('compares semver %s with %s as %s', (latest, installed, expected) => {
        expect(hasUpdate(latest, installed)).toBe(expected);
    });

    it.each<[string, string, boolean]>([
        ['1.2.3.2', '1.2.3.1', true],
        ['1.2.3.10', '1.2.3.2', true],
        ['1.2.3.2', '1.2.3.10', false],
        ['1.2.3.2', '1.2.3.2', false],
        ['1.2.4.0', '1.2.3.99', true],
        ['1.2.2.99', '1.2.3.0', false],
        ['1.2.3.1', '1.2.3', true],
        ['1.2.3', '1.2.3.1', false],
        ['1.2.3.0', '1.2.3', false],
        ['1.2.3.01', '1.2.3.1', false],
        ['1.2.3.beta', '1.2.3.alpha', true],
        ['1.2.3.alpha', '1.2.3.beta', false],
        ['1.2.3.4-beta', '1.2.3.4-alpha', true],
        ['1.2.3.beta', '1.2.3.2', true],
        ['1.2.3+build.8', '1.2.3.1', false],
        ['1.2.3.1', '1.2.3+build.9', true],
    ])('compares a legacy version %s with %s as %s', (latest, installed, expected) => {
        expect(hasUpdate(latest, installed)).toBe(expected);
    });
});
