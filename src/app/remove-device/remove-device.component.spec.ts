import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RemoveDeviceComponent } from './remove-device.component';

describe('RemoveDeviceComponent', () => {
  let component: RemoveDeviceComponent;
  let fixture: ComponentFixture<RemoveDeviceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RemoveDeviceComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RemoveDeviceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
