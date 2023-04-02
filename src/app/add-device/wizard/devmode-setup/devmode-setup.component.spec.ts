import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DevmodeSetupComponent } from './devmode-setup.component';

describe('DevmodeSetupComponent', () => {
  let component: DevmodeSetupComponent;
  let fixture: ComponentFixture<DevmodeSetupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DevmodeSetupComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DevmodeSetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
