import {afterEach, describe, expect, it, vi} from 'vitest';
import {firstValueFrom} from 'rxjs';
import {AppsRepoService, PackageManifest, RepositoryItem} from './apps-repo.service';
import {mockBackend} from '../../../testing/tauri-mock';
import {mockHttp} from '../../../testing/tauri-http-mock';

const base = 'https://repo.webosbrew.org/api';
const item = {id: 'example.app', title: 'Example', iconUri: 'https://example.com/icon.png',
    manifest: {id: 'example.app', version: '1.2.3'}, fullDescriptionUrl: './description.html'};
const page = {paging: {page: 1, count: 1, maxPage: 1, itemsTotal: 1}, packages: [item]};
const service = () => new AppsRepoService();

function respond(body: unknown, status = 200) {
    mockBackend(mockHttp([{url: /./, response: {body, status}}]));
}

afterEach(() => vi.useRealTimers());

describe('AppsRepoService repository requests', () => {
    it.each([0, 1, 2])('routes page %s and constructs repository models', async requested => {
        const url = `${base}/${requested > 1 ? `apps/${requested}.json` : 'apps.json'}`;
        mockBackend(mockHttp([{url, response: {body: page}}]));
        const result = await firstValueFrom(service().allApps$(requested));
        expect(result.paging).toEqual(page.paging);
        expect(result.packages[0]).toBeInstanceOf(RepositoryItem);
        expect(result.packages[0].manifest).toBeInstanceOf(PackageManifest);
        expect(result.packages[0].fullDescriptionUrl).toBe(new URL('./description.html', url).toString());
    });

    it('accepts a valid empty page', async () => {
        respond({paging: {page: 1, count: 0, maxPage: 0, itemsTotal: 0}, packages: []});
        expect((await firstValueFrom(service().allApps$())).packages).toEqual([]);
    });

    it('rejects HTTP error JSON instead of accepting it as an empty page', async () => {
        respond({message: 'Unavailable'}, 503);
        await expect(firstValueFrom(service().allApps$())).rejects.toThrow('HTTP 503');
    });

    it('disposes an unread HTTP error body without waiting for it', async () => {
        vi.useFakeTimers();
        const cancel = vi.fn(() => null);
        mockBackend({...mockHttp([{url: /./, response: {status: 503}}]),
            'http/fetch_read_body': () => new Promise(() => {}), 'http/fetch_cancel_body': cancel});
        let result: unknown = 'pending';
        void firstValueFrom(service().allApps$()).then(value => result = value, error => result = error);
        await vi.advanceTimersByTimeAsync(0);
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toContain('HTTP 503');
        expect(cancel).toHaveBeenCalled();
    });

    it.each([
        null, [], {}, {packages: []}, {paging: page.paging},
        {paging: page.paging, packages: {}}, {paging: {...page.paging, page: '1'}, packages: []},
        {paging: {...page.paging, count: -1}, packages: []},
        {paging: {...page.paging, maxPage: 1.5}, packages: []},
        {paging: {...page.paging, itemsTotal: null}, packages: []},
        {paging: page.paging, packages: [null]},
    ])('rejects malformed repository page %#', async body => {
        // JSON null needs an explicit serialized body in this HTTP fixture.
        respond(body === null ? 'null' : body);
        await expect(firstValueFrom(service().allApps$())).rejects.toThrow('Invalid repository page');
    });

    it('reports malformed JSON usefully', async () => {
        respond('{broken');
        await expect(firstValueFrom(service().allApps$())).rejects.toThrow('Invalid JSON');
    });

    it('preserves network errors', async () => {
        const failure = new Error('Network unavailable');
        mockBackend({'http/fetch': () => Promise.reject(failure)});
        await expect(firstValueFrom(service().allApps$())).rejects.toBe(failure);
    });

    it.each(['headers', 'body'])('aborts stalled %s after the full request deadline', async stage => {
        vi.useFakeTimers();
        const cancel = vi.fn(() => null);
        const cancelBody = vi.fn(() => null);
        mockBackend({...mockHttp([{url: /./, response: {body: page}}]),
            ...(stage === 'headers' ? {'http/fetch_send': () => new Promise(() => {})}
                : {'http/fetch_read_body': () => new Promise(() => {})}),
            'http/fetch_cancel': cancel, 'http/fetch_cancel_body': cancelBody});
        let result: unknown = 'pending';
        void firstValueFrom(service().allApps$()).then(value => result = value, error => result = error);
        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(29_999);
        expect(result).toBe('pending');
        await vi.advanceTimersByTimeAsync(1);
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toContain('timed out');
        expect(cancel).toHaveBeenCalledOnce();
        if (stage === 'body') expect(cancelBody).toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('uses one deadline across headers and body, rather than restarting for JSON', async () => {
        vi.useFakeTimers();
        const handlers = mockHttp([{url: /./, response: {body: page}}]);
        const send = handlers['http/fetch_send'];
        mockBackend({...handlers,
            'http/fetch_send': args => new Promise(resolve => setTimeout(() => resolve(send(args)), 20_000)),
            'http/fetch_read_body': () => new Promise(() => {})});
        let result: unknown = 'pending';
        void firstValueFrom(service().allApps$()).catch(error => result = error);
        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(30_000);
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toContain('timed out');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('clears the deadline after success or failure', async () => {
        vi.useFakeTimers();
        respond(page);
        await firstValueFrom(service().allApps$());
        expect(vi.getTimerCount()).toBe(0);
        respond('{bad');
        await expect(firstValueFrom(service().allApps$())).rejects.toThrow();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('keeps missing optional metadata best-effort, even for a JSON 404 body', async () => {
        respond({message: 'Not found'}, 404);
        expect(await service().showApp('missing')).toBeUndefined();
    });

    it('keeps valid optional metadata and filters failed lookups', async () => {
        mockBackend(mockHttp([
            {url: `${base}/apps/example.app/releases/latest.json`, response: {body: item}},
            {url: `${base}/apps/missing/releases/latest.json`, response: {status: 404, body: 'Not found'}},
        ]));
        const result = await service().showApps('example.app', 'missing');
        expect(Object.keys(result)).toEqual(['example.app']);
        expect(result['example.app']).toBeInstanceOf(RepositoryItem);
        expect(result['example.app'].manifest?.version).toBe('1.2.3');
    });
});
