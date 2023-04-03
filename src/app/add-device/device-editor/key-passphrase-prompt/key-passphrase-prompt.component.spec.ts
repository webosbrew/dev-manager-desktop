import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KeyPassphrasePromptComponent } from './key-passphrase-prompt.component';

describe('KeyPassphrasePromptComponent', () => {
  let component: KeyPassphrasePromptComponent;
  let fixture: ComponentFixture<KeyPassphrasePromptComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ KeyPassphrasePromptComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KeyPassphrasePromptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
