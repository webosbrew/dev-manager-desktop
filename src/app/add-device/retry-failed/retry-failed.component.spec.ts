import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RetryFailedComponent } from './retry-failed.component';

describe('RetryFailedComponent', () => {
  let component: RetryFailedComponent;
  let fixture: ComponentFixture<RetryFailedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RetryFailedComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RetryFailedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
