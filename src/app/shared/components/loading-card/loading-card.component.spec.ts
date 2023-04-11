import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadingCardComponent } from './loading-card.component';

describe('LoadingCardComponent', () => {
  let component: LoadingCardComponent;
  let fixture: ComponentFixture<LoadingCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LoadingCardComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoadingCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
