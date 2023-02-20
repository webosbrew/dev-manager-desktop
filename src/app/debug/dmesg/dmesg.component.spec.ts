import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DmesgComponent } from './dmesg.component';

describe('MessagesComponent', () => {
  let component: DmesgComponent;
  let fixture: ComponentFixture<DmesgComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DmesgComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DmesgComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
