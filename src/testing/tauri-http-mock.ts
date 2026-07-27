import {CommandHandlers} from './tauri-mock';

export interface MockResponse {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    /** Serialized as the response body. Objects are JSON-encoded. */
    body?: unknown;
}

/** Matched against the request URL: exact string, or a pattern to `test()`. */
export type RouteMatcher = string | RegExp;

export interface HttpRoute {
    url: RouteMatcher;
    method?: string;
    response: MockResponse | ((url: string) => MockResponse);
}

interface PendingRequest {
    url: string;
    response: MockResponse;
    bodyRead: boolean;
}

/**
 * Stubs `fetch` from `@tauri-apps/plugin-http`, which is what `AppsRepoService`
 * and `UpdateService` use — it is not the browser `fetch`, so `HttpTestingController`
 * cannot see it. The plugin drives four commands per request, so a single stubbed
 * response has to be handed back across `fetch` -> `fetch_send` -> `fetch_read_body`,
 * keyed by a resource id.
 *
 * Spread the result into a {@link mockBackend} handler map:
 *
 * ```ts
 * mockBackend({
 *   ...mockHttp([{url: /\/api\/apps\.json$/, response: {body: {packages: []}}}]),
 *   'device-manager/list': () => [],
 * });
 * ```
 */
export function mockHttp(routes: HttpRoute[]): CommandHandlers {
    const pending = new Map<number, PendingRequest>();
    let nextRid = 1;

    function matches(route: HttpRoute, url: string, method: string): boolean {
        if (route.method && route.method.toUpperCase() !== method.toUpperCase()) {
            return false;
        }
        return typeof route.url === 'string' ? route.url === url : route.url.test(url);
    }

    function bodyBytes(response: MockResponse): number[] {
        const {body} = response;
        if (body === undefined || body === null) {
            return [];
        }
        const text = typeof body === 'string' ? body : JSON.stringify(body);
        return [...new TextEncoder().encode(text)];
    }

    return {
        'http/fetch': ({clientConfig}) => {
            const url: string = clientConfig.url;
            const method: string = clientConfig.method ?? 'GET';
            const route = routes.find(r => matches(r, url, method));
            if (!route) {
                throw new Error(`No mock HTTP route for ${method} ${url}`);
            }
            const rid = nextRid++;
            const response = typeof route.response === 'function' ? route.response(url) : route.response;
            pending.set(rid, {url, response, bodyRead: false});
            return rid;
        },
        'http/fetch_send': ({rid}) => {
            const request = pending.get(rid)!;
            return {
                status: request.response.status ?? 200,
                statusText: request.response.statusText ?? 'OK',
                url: request.url,
                headers: request.response.headers ?? {'content-type': 'application/json'},
                // Reusing the request rid as the body rid keeps the bookkeeping to one map.
                rid,
            };
        },
        'http/fetch_read_body': ({rid}) => {
            const request = pending.get(rid)!;
            if (request.bodyRead) {
                // A trailing 1 byte is the plugin's end-of-stream signal.
                return [1];
            }
            request.bodyRead = true;
            return [...bodyBytes(request.response), 1];
        },
        'http/fetch_cancel': () => null,
        'http/fetch_cancel_body': () => null,
    };
}
