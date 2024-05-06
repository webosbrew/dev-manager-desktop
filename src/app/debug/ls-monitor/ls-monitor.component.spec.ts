import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LsMonitorComponent } from './ls-monitor.component';

describe('LsMonitorComponent', () => {
  let component: LsMonitorComponent;
  let fixture: ComponentFixture<LsMonitorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LsMonitorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LsMonitorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
