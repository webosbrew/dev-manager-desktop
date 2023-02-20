import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PmLogControlComponent } from './control.component';

describe('ControlComponent', () => {
  let component: PmLogControlComponent;
  let fixture: ComponentFixture<PmLogControlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PmLogControlComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PmLogControlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
