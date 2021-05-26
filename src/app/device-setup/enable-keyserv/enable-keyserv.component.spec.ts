import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnableKeyservComponent } from './enable-keyserv.component';

describe('EnableKeyservComponent', () => {
  let component: EnableKeyservComponent;
  let fixture: ComponentFixture<EnableKeyservComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EnableKeyservComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EnableKeyservComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
