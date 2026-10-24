import {CommonModule, NgOptimizedImage} from '@angular/common';
import {NgbPaginationModule} from '@ng-bootstrap/ng-bootstrap';
import {ErrorCardComponent} from '../../shared/components/error-card/error-card.component';
import {LoadingCardComponent} from '../../shared/components/loading-card/loading-card.component';
import {By} from '@angular/platform-browser';
import {Component, ErrorHandler} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {Subject} from 'rxjs';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AppsRepoService, PackageManifest, RepositoryItem, RepositoryPage} from '../../core/services/apps-repo.service';
import {AppsComponent} from '../apps.component';
import {ChannelComponent} from './channel.component';

@Component({standalone: false, template: '',
    viewProviders: [{provide: AppsComponent, useValue: {openDetails: vi.fn()}}]})
class HostComponent {}

const emptyPage = () => new RepositoryPage({paging: {page: 2, count: 0, maxPage: 2, itemsTotal: 0}, packages: []},
    'https://repo.webosbrew.org/api/apps/2.json');

describe('ChannelComponent repository loading', () => {
    const requests: Subject<RepositoryPage>[] = [];
    const allApps = vi.fn((_page: number) => {
        const response = new Subject<RepositoryPage>();
        requests.push(response);
        return response.asObservable();
    });

    beforeEach(async () => {
        requests.length = 0;
        allApps.mockClear();
        await TestBed.configureTestingModule({
            declarations: [HostComponent, ChannelComponent, ErrorCardComponent, LoadingCardComponent],
            imports: [CommonModule, NgOptimizedImage, NgbPaginationModule],
            providers: [{provide: AppsRepoService, useValue: {allApps$: allApps}},
                {provide: ErrorHandler, useValue: {handleError: vi.fn()}}],
            rethrowApplicationErrors: false,
        }).overrideTemplate(HostComponent, '<app-channel/>').compileComponents();
    });

    it('renders an error and retries the current page from loading to success', async () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        fixture.debugElement.query(By.directive(ChannelComponent)).componentInstance.loadPage(2);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('app-loading-card')).not.toBeNull();
        requests[1].error(new Error('Repository HTTP 503'));
        fixture.detectChanges();
        await fixture.whenStable();
        const card = fixture.nativeElement.querySelector('app-error-card');
        expect(card).not.toBeNull();
        expect(card.textContent).toContain('Repository HTTP 503');
        expect(fixture.nativeElement.querySelector('app-loading-card')).toBeNull();
        card.querySelector('button').click();
        fixture.detectChanges();
        expect(allApps).toHaveBeenLastCalledWith(2);
        expect(fixture.nativeElement.querySelector('app-error-card')).toBeNull();
        expect(fixture.nativeElement.querySelector('app-loading-card')).not.toBeNull();
        requests[2].next(new RepositoryPage({paging: {page: 2, count: 1, maxPage: 2, itemsTotal: 1}, packages: [
            new RepositoryItem({id: 'example', title: 'Example app', iconUri: 'https://example.com/icon.png',
                manifest: new PackageManifest({version: '1.2.3', appDescription: 'An application'})}, 'https://example.com/api/apps/2.json')]}, 'https://example.com/api/apps/2.json'));
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Example app');
        expect(fixture.nativeElement.querySelector('app-error-card')).toBeNull();
        expect(fixture.nativeElement.querySelector('app-loading-card')).toBeNull();
        fixture.destroy();
    });

    it('ignores an old page error before AsyncPipe subscribes to the newly requested page', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        fixture.debugElement.query(By.directive(ChannelComponent)).componentInstance.loadPage(2);
        // The old subscription is still active until the next change-detection pass.
        requests[0].error(new Error('Old page failed'));
        fixture.detectChanges();
        requests[1].next(emptyPage());
        fixture.detectChanges();
        expect(allApps).toHaveBeenLastCalledWith(2);
        expect(fixture.nativeElement.querySelector('app-error-card')).toBeNull();
        expect(fixture.nativeElement.querySelector('app-loading-card')).toBeNull();
        expect(fixture.nativeElement.querySelector('ngb-pagination')).not.toBeNull();
        fixture.destroy();
    });

    it('renders a successful empty page without a loading or error card', () => {
        const fixture = TestBed.createComponent(HostComponent);
        fixture.detectChanges();
        requests[0].next(emptyPage());
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('app-loading-card')).toBeNull();
        expect(fixture.nativeElement.querySelector('app-error-card')).toBeNull();
        expect(fixture.nativeElement.querySelector('ngb-pagination')).not.toBeNull();
        fixture.destroy();
    });
});
