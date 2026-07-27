import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import {emit} from '@tauri-apps/api/event';

import {DeviceChooserComponent} from './device-chooser.component';
import {DeviceManagerService} from '../../core/services';
import {Device} from '../../types';
import {mockBackend, resetBackend} from '../../../testing/tauri-mock';

describe('DeviceChooserComponent', () => {
    const devices = <Device[]>[
        {name: 'living-room', host: '192.168.1.1', port: 22, username: 'root', profile: 'ose'},
        {name: 'bedroom', host: '192.168.1.2', port: 22, username: 'root', profile: 'ose'},
    ];

    let fixture: ComponentFixture<DeviceChooserComponent>;
    let modal: jasmine.SpyObj<NgbActiveModal>;

    beforeEach(async () => {
        mockBackend({'device-manager/list': () => devices});
        modal = jasmine.createSpyObj<NgbActiveModal>('NgbActiveModal', ['close', 'dismiss']);

        await TestBed.configureTestingModule({
            imports: [DeviceChooserComponent],
            providers: [{provide: NgbActiveModal, useValue: modal}],
        }).compileComponents();

        fixture = TestBed.createComponent(DeviceChooserComponent);
    });

    afterEach(() => resetBackend());

    function renderedNames(): string[] {
        return Array.from(fixture.nativeElement.querySelectorAll('li'))
            .map(li => (li as HTMLElement).textContent!.trim());
    }

    it('renders nothing before the backend has answered', () => {
        fixture.detectChanges();
        expect(renderedNames()).toEqual([]);
    });

    it('renders one row per device once loaded', async () => {
        TestBed.inject(DeviceManagerService).load();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(renderedNames()).toEqual(['living-room', 'bedroom']);
    });

    it('re-renders when the backend pushes a device list', async () => {
        fixture.detectChanges();

        await emit('device-manager/devicesUpdated', [devices[1]]);
        await fixture.whenStable();
        fixture.detectChanges();

        expect(renderedNames()).toEqual(['bedroom']);
    });

    it('closes the modal with the clicked device', async () => {
        TestBed.inject(DeviceManagerService).load();
        await fixture.whenStable();
        fixture.detectChanges();

        fixture.nativeElement.querySelectorAll('li')[1].click();

        expect(modal.close).toHaveBeenCalledWith(devices[1]);
    });
});
