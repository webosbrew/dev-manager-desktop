import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {Mock, vi} from 'vitest';

import {AddDeviceComponent} from './add-device.component';
import {AddDeviceModule} from '../../add-device.module';
import {DeviceConnectionMode} from '../mode-select/mode-select.component';
import {CommandHandler, mockBackend} from '../../../../testing/tauri-mock';


describe('AddDeviceComponent addresses', () => {
    let fixture: ComponentFixture<AddDeviceComponent>;
    let fetchKey: Mock<CommandHandler>;
    let execute: Mock<CommandHandler>;
    let save: Mock<CommandHandler>;

    beforeEach(async () => {
        fetchKey = vi.fn<CommandHandler>(() => 'test-private-key');
        execute = vi.fn<CommandHandler>(({command}) => ({
            stdout: JSON.stringify(command.includes('getSystemInfo') ? {
                returnValue: true, modelName: 'test-tv', firmwareVersion: '1.0', sdkVersion: '6.0', otaId: 'test',
            } : {returnValue: true, device_name: 'test', webos_release: '6.0'}),
            stderr: '',
        }));
        save = vi.fn<CommandHandler>(({device}) => device);
        mockBackend({
            'device-manager/app_ssh_pubkey': () => 'ssh-ed25519 test',
            'device-manager/list': () => [],
            'device-manager/novacom_getkey': fetchKey,
            'remote-command/exec': execute,
            'device-manager/add': save,
        });
        await TestBed.configureTestingModule({
            imports: [AddDeviceModule],
            providers: [{provide: NgbModal, useValue: {open: () => ({close: vi.fn()})}}],
        }).compileComponents();
        fixture = TestBed.createComponent(AddDeviceComponent);
        fixture.componentRef.setInput('mode', DeviceConnectionMode.DevMode);
        fixture.detectChanges();
        fixture.componentInstance.deviceEditor.formGroup.controls.sshAuth.controls.value.setValue('TEST123');
        await fixture.whenStable();
    });

    const validAddresses = [
        '192.168.1.2', '0.0.0.0', '255.255.255.255', 'tv', 'living-room', 'TV123', '123tv',
        'tv.home.arpa', 'tv.local', 'tv.example.com.', 'xn--bcher-kva.local',
        `${'a'.repeat(63)}.local`, `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`,
    ];
    const invalidAddresses = [
        '', '256.1.2.3', '192.168.1', '192.168.01.2', '192.168.1.2.3', '12345', '192.168.1.2.',
        'http://tv.local', 'tv.local:9922', 'tv.local/path', 'user@tv.local',
        ' tv.local', 'tv.local ', 'tv local', 'tv.local\n', '192.168.1.2\n', 'tv\tlocal', '-tv.local', 'tv-.local',
        'tv..local', 'tv_local', '.', '::1', '[::1]', 'bücher.local',
        `${'a'.repeat(64)}.local`, `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}`,
    ];

    it.each(validAddresses)('accepts address %s', address => {
        const control = fixture.componentInstance.deviceEditor.formGroup.controls.address;
        control.setValue(address);
        expect(control.valid).toBe(true);
    });

    it.each(invalidAddresses)('rejects address %s', address => {
        const control = fixture.componentInstance.deviceEditor.formGroup.controls.address;
        control.setValue(address);
        expect(control.invalid).toBe(true);
    });

    it.each(['tv.local', 'living-room', 'tv.home.arpa.', '192.168.1.2'])(
        'passes %s unchanged through key fetch, connection verification and device save', async address => {
            const input = fixture.nativeElement.querySelector('#deviceAddress') as HTMLInputElement;
            input.value = address;
            input.dispatchEvent(new Event('input'));
            fixture.detectChanges();
            await fixture.whenStable();
            expect(fixture.componentInstance.valid).toBe(true);
            const added = vi.fn();
            fixture.componentInstance.deviceAdded.subscribe(added);

            await fixture.componentInstance.submit();

            expect(fetchKey).toHaveBeenCalledWith({address, passphrase: 'TEST123'});
            expect(execute).toHaveBeenCalledTimes(2);
            for (const [args] of execute.mock.calls) {
                expect(args).toMatchObject({device: {host: address, port: 9922, privateKey: {openSshData: 'test-private-key'}}});
            }
            expect(save).toHaveBeenCalledWith({device: expect.objectContaining({host: address, port: 9922})});
            expect(added).toHaveBeenCalledWith(expect.objectContaining({host: address}));
        },
    );

    it('rejects invalid input before attempting key fetch, connection or save', async () => {
        fixture.componentInstance.deviceEditor.formGroup.controls.address.setValue('tv.local:9922');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('.invalid-feedback.d-block').textContent).toContain('IPv4 address or hostname');
        await expect(fixture.componentInstance.submit()).rejects.toThrow('Missing required fields');
        expect(fetchKey).not.toHaveBeenCalled();
        expect(execute).not.toHaveBeenCalled();
        expect(save).not.toHaveBeenCalled();
    });
});
