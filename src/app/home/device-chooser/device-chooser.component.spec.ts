import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeviceChooserComponent } from './device-chooser.component';

describe('DeviceChooserComponent', () => {
  let component: DeviceChooserComponent;
  let fixture: ComponentFixture<DeviceChooserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeviceChooserComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DeviceChooserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
