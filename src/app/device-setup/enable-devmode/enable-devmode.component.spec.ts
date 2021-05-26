import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnableDevmodeComponent } from './enable-devmode.component';

describe('EnableDevmodeComponent', () => {
  let component: EnableDevmodeComponent;
  let fixture: ComponentFixture<EnableDevmodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EnableDevmodeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EnableDevmodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
