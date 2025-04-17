import {ComponentFixture, TestBed} from '@angular/core/testing';

import {InlineEditorComponent} from './inline-editor.component';
import {Device} from "../../types";
import {clearMocks, mockIPC, mockWindows} from "@tauri-apps/api/mocks";

describe('InlineEditorComponent', () => {
  let component: InlineEditorComponent;
  let fixture: ComponentFixture<InlineEditorComponent>;

  beforeEach(async () => {
    mockWindows("main");
    mockIPC((cmd, args) => {
      switch (cmd) {
        case 'plugin:device-manager|ssh_key_dir':
          return '/home/user/.ssh';
        case 'plugin:device-manager|list':
          return [];
        case 'plugin:device-manager|app_ssh_pubkey':
          return 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC3...';
      }
      throw new Error(`Unknown command: ${cmd}`);
    });
    (window as any)['__TAURI_INTERNALS__'].plugins = {
      path: {sep: '/'},
    }
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

  afterEach(() => {
    clearMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
