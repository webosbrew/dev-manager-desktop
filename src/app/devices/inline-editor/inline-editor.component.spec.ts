import {ComponentFixture, TestBed} from '@angular/core/testing';

import {InlineEditorComponent} from './inline-editor.component';
import {Device, NewDeviceAuthentication} from "../../types";
import {mockBackend} from "../../../testing/tauri-mock";

describe('InlineEditorComponent', async () => {
  let component: InlineEditorComponent;
  let fixture: ComponentFixture<InlineEditorComponent>;

  beforeEach(async () => {
    // Everything the embedded device editor reaches for while initialising.
    mockBackend({
      'device-manager/app_ssh_pubkey': () => 'ssh-ed25519 AAAAC3Nz test',
      'device-manager/ssh_key_dir': () => '/home/test/.ssh',
      'device-manager/list': () => [],
      'device-manager/localkey_verify': () => null,
    });

    await TestBed.configureTestingModule({
      imports: [InlineEditorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(InlineEditorComponent);
    component = fixture.componentInstance;
    component.device = <Device>{
      name: 'test',
      host: '192.168.1.1',
      port: 22,
      username: 'root',
      profile: 'ose',
      privateKey: {openSsh: 'test'},
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('selects no authentication for a device without a password or key', () => {
    const device = {...component.device, username: 'prisoner', privateKey: undefined};
    fixture = TestBed.createComponent(InlineEditorComponent);
    component = fixture.componentInstance;
    component.device = device;
    expect(component.deviceAuth).toEqual({type: NewDeviceAuthentication.None, value: null});
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('#authMethod') as HTMLSelectElement).value).toBe('none');
  });
});
