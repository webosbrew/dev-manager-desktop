import {ComponentFixture, DeferBlockBehavior, TestBed} from '@angular/core/testing';
import {provideLocationMocks} from '@angular/common/testing';
import {Router} from '@angular/router';
import {emit} from '@tauri-apps/api/event';

import {AppComponent} from './app.component';
import {AppModule} from './app.module';
import {Device} from './types';
import {mockBackend, resetBackend} from '../testing/tauri-mock';
import {mockHttp} from '../testing/tauri-http-mock';

/**
 * End-to-end in the browser: the real AppModule, the real router and the real
 * lazily-loaded route components, with nothing behind the IPC boundary but stubs.
 *
 * This is the widest net the harness casts — it covers routing, the app shell and
 * cross-component wiring that a per-component spec cannot reach, and it needs no
 * Tauri window, no webOS device and no network.
 *
 * These specs are `async`, not `fakeAsync`: the router resolves route components
 * through dynamic `import()`, and those promises settle outside the fake async
 * zone, so `tick()` never sees them.
 */
describe('App (mocked backend e2e)', () => {
    const devices = <Device[]>[
        {name: 'living-room', host: '192.168.1.1', port: 22, username: 'root', profile: 'ose'},
        {name: 'bedroom', host: '192.168.1.2', port: 22, username: 'root', profile: 'ose'},
    ];

    let fixture: ComponentFixture<AppComponent>;
    let router: Router;

    /** Every call the shell makes on startup. */
    function shellHandlers() {
        return {
            ...mockHttp([
                {
                    // The update check. Reporting an old version keeps the
                    // "update available" modal from covering the assertions.
                    url: /api\.github\.com\/.*\/releases\/latest$/,
                    response: {body: {tag_name: 'v0.0.1', html_url: 'https://example.invalid', body: ''}},
                },
                {url: /repo\.webosbrew\.org\/api\//, response: {body: {packages: [], paging: {page: 1, count: 0}}}},
            ]),
            'device-manager/list': () => devices,
        };
    }

    async function settle(): Promise<void> {
        // A macrotask turn first: the mocked IPC handler resolves outside the
        // Angular zone, so whenStable() alone can return before it has run.
        await new Promise(resolve => setTimeout(resolve, 0));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    /** Device rows on the devices screen, minus the trailing "Add new device..." row. */
    function deviceRows(): string[] {
        return Array.from(fixture.nativeElement.querySelectorAll('.list-group-item div:first-child'))
            .map(el => (el as HTMLElement).textContent!.trim())
            .filter(text => text.length > 0);
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AppModule],
            providers: [provideLocationMocks()],
            // The devices screen keeps its row editor behind a @defer block that only
            // opens on click. TestBed would otherwise render every deferred block
            // immediately, instantiating editors for rows nobody selected.
            deferBlockBehavior: DeferBlockBehavior.Manual,
        }).compileComponents();
    });

    /**
     * Installs the mocks and *then* boots the shell. Order matters: AppComponent's
     * constructor calls `deviceManager.load()`, so a mock swapped in after
     * `createComponent` would arrive too late to affect the first load.
     */
    function boot(handlers: Record<string, (args: any) => unknown> = shellHandlers()): void {
        resetBackend();
        mockBackend(handlers);
        router = TestBed.inject(Router);
        fixture = TestBed.createComponent(AppComponent);
        fixture.detectChanges();
    }

    afterEach(() => resetBackend());

    it('boots the shell without reaching a real backend', async () => {
        boot();
        await settle();

        expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
    });

    it('navigates to the devices route and lists what the backend returned', async () => {
        boot();

        await router.navigate(['/home/devices']);
        await settle();

        expect(deviceRows()).toEqual(['living-room', 'bedroom']);
    });

    it('re-renders the devices route when the backend pushes a new list', async () => {
        boot();
        await router.navigate(['/home/devices']);
        await settle();
        // Guard against a false pass: the assertion below is only meaningful if
        // the screen was actually populated first.
        expect(deviceRows().length).toBe(2);

        await emit('device-manager/devicesUpdated', [devices[1]]);
        await settle();

        expect(deviceRows()).toEqual(['bedroom']);
    });

    // Not covered here: a failing `device-manager/list` at startup. `DeviceManagerService.load()`
    // calls `this.list().then(...)` with no `.catch`, so a rejection escapes as an unhandled
    // promise rejection and takes the whole karma run down rather than failing one spec.
    // Error mapping is covered at the service level in device-manager.service.spec.ts.
});
