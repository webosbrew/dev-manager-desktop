import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DevmodeComponent } from './devmode.component';

describe('DevmodeComponent', () => {
  let component: DevmodeComponent;
  let fixture: ComponentFixture<DevmodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DevmodeComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DevmodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
