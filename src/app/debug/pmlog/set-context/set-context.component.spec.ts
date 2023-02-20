import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetContextComponent } from './set-context.component';

describe('SetContextComponent', () => {
  let component: SetContextComponent;
  let fixture: ComponentFixture<SetContextComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SetContextComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SetContextComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
