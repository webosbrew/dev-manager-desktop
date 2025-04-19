import {ComponentFixture, TestBed} from '@angular/core/testing';

import {InlineEditorComponent} from './inline-editor.component';
import {Device} from "../../types";

describe('InlineEditorComponent', async () => {
  let component: InlineEditorComponent;
  let fixture: ComponentFixture<InlineEditorComponent>;

  beforeEach(async () => {
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
});
