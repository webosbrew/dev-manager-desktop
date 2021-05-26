import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrepareAccountComponent } from './prepare-account.component';

describe('PrepareAccountComponent', () => {
  let component: PrepareAccountComponent;
  let fixture: ComponentFixture<PrepareAccountComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PrepareAccountComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PrepareAccountComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
