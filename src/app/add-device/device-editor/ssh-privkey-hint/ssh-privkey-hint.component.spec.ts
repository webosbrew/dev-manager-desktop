import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SshPrivkeyHintComponent } from './ssh-privkey-hint.component';

describe('SshPrivkeyHintComponent', () => {
  let component: SshPrivkeyHintComponent;
  let fixture: ComponentFixture<SshPrivkeyHintComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SshPrivkeyHintComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SshPrivkeyHintComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
