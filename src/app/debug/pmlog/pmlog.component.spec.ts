import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PmLogComponent } from './pmlog.component';

describe('MessagesComponent', () => {
  let component: PmLogComponent;
  let fixture: ComponentFixture<PmLogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PmLogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PmLogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
