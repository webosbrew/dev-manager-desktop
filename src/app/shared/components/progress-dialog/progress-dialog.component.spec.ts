import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProgressDialogComponent } from './progress-dialog.component';

describe('ProgressDialogComponent', () => {
  let component: ProgressDialogComponent;
  let fixture: ComponentFixture<ProgressDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProgressDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProgressDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
