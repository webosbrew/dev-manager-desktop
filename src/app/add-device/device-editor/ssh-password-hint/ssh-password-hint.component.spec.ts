import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SshPasswordHintComponent } from './ssh-password-hint.component';

describe('SshPasswordHintComponent', () => {
  let component: SshPasswordHintComponent;
  let fixture: ComponentFixture<SshPasswordHintComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SshPasswordHintComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SshPasswordHintComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
