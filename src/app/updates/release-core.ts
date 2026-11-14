/**
 * Release lookup for homebrew TV apps: turns a repository link (GitHub, GitLab or Codeberg/Gitea/Forgejo)
 * into its newest release that carries an .ipk, compares versions and reads an .ipk's app id.
 */

export interface Source {
    type: 'github' | 'gitlab' | 'gitea';
    host: string;
    owner?: string;
    repo?: string;
    /** GitLab path, which can include subgroups */
    project?: string;
    url: string;
}

export interface Release {
    version: string;
    tag: string | null;
    ipkUrl: string;
    ipkName: string;
    size: number;
    sha256: string | null;
    date: string | null;
    prerelease: boolean;
    page: string;
    notes: string;
    /** every .ipk in this release, for choosing a package */
    assets: Asset[];
}

export interface JsonClient {
    json(url: string): Promise<any>;
}

export interface Asset {
    name: string;
    url: string;
    size?: number;
    sha256?: string | null;
}

interface RawRelease {
    tag: string;
    draft?: boolean;
    prerelease?: boolean;
    date?: string | null;
    page?: string;
    notes?: string | null;
    assets: Asset[];
}

/** Bytes needed to read an .ipk's control file: it sits at the start of the archive */
export const PROBE_BYTES = 512 * 1024;

/**
 * Accepts what a person pastes: "github.com/o/r", "https://github.com/o/r/releases", "o/r" (GitHub), GitLab and
 * Codeberg/Gitea/Forgejo projects. A link to one .ipk file cannot be tracked for new versions, so a release
 * download link is turned into its repository and any other .ipk link is refused.
 */
export function parseSource(input: string): Source {
    let url = String(input || '').trim();
    if (!url) throw new Error('Empty link');
    if (/^[\w.-]+\/[\w.-]+$/.test(url)) url = 'https://github.com/' + url;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const m = /^https?:\/\/([^\/]+)(\/[^?#]*)?/i.exec(url);
    if (!m) throw new Error('Not a link: ' + input);
    const host = m[1].toLowerCase(), path = (m[2] || '/').replace(/\/+$/, '');
    const parts = path.split('/').filter(Boolean);
    const isForge = /(^|\.)(github\.com|gitlab\.com|codeberg\.org)$/.test(host) || /(^|\.)gitlab\./.test(host);
    if (/\.ipk$/i.test(path) && !(isForge && parts.length > 2)) {
        throw new Error('A single .ipk file can\'t be tracked for updates. Use the app\'s GitHub, GitLab or Codeberg page instead.');
    }
    if (parts.length < 2) throw new Error('The link needs an owner and a repository: ' + input);
    const owner = parts[0], repo = parts[1].replace(/\.git$/, '');
    const type: Source['type'] = host === 'github.com' || host === 'www.github.com' ? 'github'
        : host === 'gitlab.com' || /(^|\.)gitlab\./.test(host) ? 'gitlab'
            : 'gitea';
    if (type === 'gitlab' && parts.length > 2) {
        const dash = parts.indexOf('-');
        const full = (dash > 0 ? parts.slice(0, dash) : parts).join('/');
        return {type, host, project: full, url: `https://${host}/${full}`};
    }
    return {type, host, owner, repo, url: `https://${host}/${owner}/${repo}`};
}

/** Same link written differently counts as the same app */
export function sourceKey(input: string): string {
    try {
        return parseSource(input).url.toLowerCase();
    } catch {
        return String(input).toLowerCase();
    }
}

/** Who publishes it, shown under the app name */
export function author(url: string): string {
    try {
        const s = parseSource(url);
        return s.owner || (s.project || '').split('/')[0] || s.host;
    } catch {
        return '';
    }
}

function cleanVersion(v: string | null | undefined): string {
    return String(v || '').trim().replace(/^[^\d]*(?=\d)/, '');
}

/** "1.10.2-beta" vs "1.9" -> 1. Numbers compare as numbers; a pre-release suffix sorts below the plain release. */
export function compareVersions(a: string, b: string): number {
    a = cleanVersion(a);
    b = cleanVersion(b);
    if (a === b) return 0;
    const pa = a.split(/[-+~]/), pb = b.split(/[-+~]/);
    const na = pa[0].split('.'), nb = pb[0].split('.');
    for (let i = 0; i < Math.max(na.length, nb.length); i++) {
        const x = parseInt(na[i] || '0', 10), y = parseInt(nb[i] || '0', 10);
        if (isNaN(x) || isNaN(y)) {
            const s = String(na[i] || '').localeCompare(String(nb[i] || ''));
            if (s) return s;
            continue;
        }
        if (x !== y) return x > y ? 1 : -1;
    }
    const ra = pa.slice(1).join('-'), rb = pb.slice(1).join('-');
    if (!ra && rb) return 1;
    if (ra && !rb) return -1;
    return ra.localeCompare(rb, undefined, {numeric: true});
}

/**
 * The TV keeps only plain numbers (a 0.8.5-b2 build reports 0.8.5), so an installed version is compared with a
 * release by its numbers first. When those match, the build is told apart by its suffix: `known` is the full
 * version this app last installed. Without it, a suffixed build like 0.8.5-b2 counts as newer than plain 0.8.5.
 */
export function compareInstalled(release: string, installed: string, known?: string | null): number {
    const nums = (v: string) => cleanVersion(v).split(/[-+~_\s]/)[0];
    const suffix = (v: string) => cleanVersion(v).slice(nums(v).length).replace(/^[-+~_\s]+/, '');
    const c = compareVersions(nums(release), nums(installed));
    if (c) return c;
    const rs = suffix(release);
    const ks = known && !compareVersions(nums(known), nums(installed)) ? suffix(known) : null;
    if (ks === null) return rs ? 1 : 0;
    if (rs === ks) return 0;
    if (rs && ks) return rs.localeCompare(ks, undefined, {numeric: true});
    // one is a test build and the other the plain release of the same number: a different build is an update
    return 1;
}

/** The installed version to show: the full build this app installed, when the TV's number matches it */
export function installedLabel(installed: string, known?: string | null): string {
    const nums = (v: string) => cleanVersion(v).split(/[-+~_\s]/)[0];
    return known && !compareVersions(nums(known), nums(installed)) ? cleanVersion(known) : installed;
}

/** Version from an ipk file name like com.example.app_1.2.3_all.ipk */
export function versionFromName(name: string): string | null {
    const m = /_(\d[\w.+~-]*?)_(all|arm\w*|aarch64|i686|x86\w*)\.ipk$/i.exec(name || '');
    return m ? m[1] : null;
}

// The TV's userland is 32-bit ARM: prefer arch-independent packages, then arm
const ARCH_ORDER = [/_all\.ipk$/i, /_arm(v7\w*)?\.ipk$/i, /_armhf\.ipk$/i, /_aarch64\.ipk$/i, /\.ipk$/i];

export function ipkAssets(assets: Asset[]): Asset[] {
    return assets.filter(a => /\.ipk$/i.test(a.name));
}

export function pickAsset(assets: Asset[], filter?: string): Asset | null {
    let ipks = ipkAssets(assets);
    if (filter) {
        let re: RegExp | null = null;
        try {
            re = new RegExp(filter, 'i');
        } catch {
            re = null;
        }
        if (re) ipks = ipks.filter(a => re!.test(a.name));
    }
    for (const order of ARCH_ORDER) {
        const hit = ipks.find(a => order.test(a.name));
        if (hit) return hit;
    }
    return null;
}

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Turns a chosen file name into a filter that keeps matching it in later releases: the version part becomes a
 * wildcard and the rest must match exactly, so "app_1.2_all.ipk" and "app_1.2_all_webOS22+.ipk" stay apart.
 */
export function assetPattern(name: string, tag?: string | null): string {
    const versions = [cleanVersion(tag), versionFromName(name)].filter((v): v is string => !!v);
    for (const v of versions) {
        // the tag may write the version with other separators than the file name (0.8.5-b2 vs 0.8.5_b2)
        const loose = new RegExp('(?<![\\d.])' + v.split(/[._+~-]/).filter(Boolean).map(escapeRe).join('[._+~-]') + '(?!\\d)', 'i');
        const m = loose.exec(name);
        if (m) return '^' + escapeRe(name.slice(0, m.index)) + '.+?' + escapeRe(name.slice(m.index + m[0].length)) + '$';
    }
    const generic = /\d+(?:\.\d+)+(?:[._-]?(?:alpha|beta|rc|b|a)\d*)?/i.exec(name);
    if (generic) {
        return '^' + escapeRe(name.slice(0, generic.index)) + '.+?' + escapeRe(name.slice(generic.index + generic[0].length)) + '$';
    }
    return '^' + escapeRe(name) + '$';
}

/** What tells a package apart from its siblings: "app_1.2_all_webOS22+.ipk" -> ["all", "webOS22+"] */
export function variantOf(name: string, tag?: string | null): string[] {
    const m = /\^(.*?)\.\+\?(.*)\$$/.exec(assetPattern(name, tag));
    const rest = m ? m[2].replace(/\\(.)/g, '$1') : name;
    return rest.replace(/\.ipk$/i, '').split(/[_\s]+/).filter(Boolean);
}

/** The same release, using another of its .ipk files */
export function withAsset(release: Release, name: string): Release {
    const asset = release.assets.find(a => a.name === name);
    if (!asset) throw new Error(`${name} is not in this release`);
    return {
        ...release, version: versionFromName(asset.name) || cleanVersion(release.tag) || release.tag || '',
        ipkUrl: asset.url, ipkName: asset.name, size: asset.size || 0, sha256: asset.sha256 || null,
    };
}

/** Newest release that carries an .ipk */
export async function latest(entry: { url: string, prerelease?: boolean, filter?: string }, http: JsonClient): Promise<Release> {
    const src = parseSource(entry.url), pre = !!entry.prerelease, filter = entry.filter || '';
    const pick = (list: RawRelease[]): Release => {
        let sawIpk = false;
        for (const r of list) {
            if (r.draft || (r.prerelease && !pre)) continue;
            if (ipkAssets(r.assets).length) sawIpk = true;
            const asset = pickAsset(r.assets, filter);
            if (!asset) continue;
            return {
                version: versionFromName(asset.name) || cleanVersion(r.tag) || r.tag,
                tag: r.tag, ipkUrl: asset.url, ipkName: asset.name, size: asset.size || 0,
                sha256: asset.sha256 || null, date: r.date || null, prerelease: !!r.prerelease, page: r.page || src.url,
                notes: r.notes ? String(r.notes).slice(0, 20000) : '',
                assets: ipkAssets(r.assets),
            };
        }
        if (sawIpk && filter) throw new Error('No .ipk file matches the package filter. Choose the package again.');
        throw new Error('No release with an .ipk file found');
    };
    if (src.type === 'github') {
        const list = await http.json(`https://api.github.com/repos/${src.owner}/${src.repo}/releases?per_page=15`);
        return pick(list.map((r: any): RawRelease => ({
            tag: r.tag_name, draft: r.draft, prerelease: r.prerelease, date: r.published_at, page: r.html_url, notes: r.body,
            assets: (r.assets || []).map((a: any) => ({
                name: a.name, url: a.browser_download_url, size: a.size,
                sha256: /^sha256:/.test(a.digest || '') ? a.digest.slice(7) : null,
            })),
        })));
    }
    if (src.type === 'gitlab') {
        const project = src.project || `${src.owner}/${src.repo}`;
        const list = await http.json(`https://${src.host}/api/v4/projects/${encodeURIComponent(project)}/releases?per_page=15`);
        return pick(list.map((r: any): RawRelease => ({
            tag: r.tag_name, prerelease: !!r.upcoming_release, date: r.released_at, page: r._links?.self, notes: r.description,
            assets: (r.assets?.links || []).map((a: any) => ({name: a.name, url: a.direct_asset_url || a.url})),
        })));
    }
    const list = await http.json(`https://${src.host}/api/v1/repos/${src.owner}/${src.repo}/releases?limit=15`);
    return pick(list.map((r: any): RawRelease => ({
        tag: r.tag_name, draft: r.draft, prerelease: r.prerelease, date: r.published_at, page: r.html_url, notes: r.body,
        assets: (r.assets || []).map((a: any) => ({name: a.name, url: a.browser_download_url, size: a.size})),
    })));
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
    let s = '';
    for (let i = start; i < end && i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
}

export class TruncatedError extends Error {
}

/** An .ipk is an "ar" archive holding control.tar.gz with the package's control file */
export async function readIpkControl(bytes: Uint8Array, gunzip: (b: Uint8Array) => Promise<Uint8Array>):
    Promise<{ id: string, version: string | null }> {
    if (ascii(bytes, 0, 8) !== '!<arch>\n') throw new Error('Not an .ipk file');
    let pos = 8, control: Uint8Array | null = null;
    while (pos + 60 <= bytes.length) {
        const name = ascii(bytes, pos, pos + 16).trim().replace(/\/$/, '');
        const size = parseInt(ascii(bytes, pos + 48, pos + 58).trim(), 10);
        const start = pos + 60;
        if (name === 'control.tar.gz') {
            if (start + size > bytes.length) throw new TruncatedError('truncated');
            control = bytes.subarray(start, start + size);
            break;
        }
        pos = start + size + (size % 2);
    }
    if (!control) {
        if (pos + 60 > bytes.length) throw new TruncatedError('truncated');
        throw new Error('The .ipk has no control.tar.gz');
    }
    const tar = await gunzip(control);
    let p = 0;
    while (p + 512 <= tar.length) {
        const fname = ascii(tar, p, p + 100).replace(/\0.*$/, '');
        if (!fname) break;
        const fsize = parseInt(ascii(tar, p + 124, p + 136).replace(/\0.*$/, '').trim() || '0', 8);
        if (/(^|\/)control$/.test(fname)) {
            const text = ascii(tar, p + 512, p + 512 + fsize);
            const get = (k: string) => new RegExp(`^${k}:\\s*(.+)$`, 'mi').exec(text)?.[1].trim() ?? null;
            const id = get('Package');
            if (!id) throw new Error('The .ipk has no package id');
            return {id, version: get('Version')};
        }
        p += 512 + Math.ceil(fsize / 512) * 512;
    }
    throw new Error('The .ipk has no control file');
}
