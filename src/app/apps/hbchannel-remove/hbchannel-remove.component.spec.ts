import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HbchannelRemoveComponent } from './hbchannel-remove.component';

describe('HbchannelRemoveComponent', () => {
  let component: HbchannelRemoveComponent;
  let fixture: ComponentFixture<HbchannelRemoveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ HbchannelRemoveComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HbchannelRemoveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
