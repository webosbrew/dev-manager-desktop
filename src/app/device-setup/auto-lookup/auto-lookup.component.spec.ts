import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutoLookupComponent } from './auto-lookup.component';

describe('AutoLookupComponent', () => {
  let component: AutoLookupComponent;
  let fixture: ComponentFixture<AutoLookupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AutoLookupComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AutoLookupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
