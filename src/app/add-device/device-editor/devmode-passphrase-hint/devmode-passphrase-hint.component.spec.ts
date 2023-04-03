import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DevmodePassphraseHintComponent } from './devmode-passphrase-hint.component';

describe('DevmodePassphraseHintComponent', () => {
  let component: DevmodePassphraseHintComponent;
  let fixture: ComponentFixture<DevmodePassphraseHintComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DevmodePassphraseHintComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DevmodePassphraseHintComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
