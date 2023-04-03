import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StepHeaderComponent } from './step-header.component';

describe('StepHeaderComponent', () => {
  let component: StepHeaderComponent;
  let fixture: ComponentFixture<StepHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StepHeaderComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StepHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
