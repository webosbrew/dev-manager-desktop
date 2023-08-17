import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatStorageInfoComponent } from './stat-storage-info.component';

describe('StatStorageInfoComponent', () => {
  let component: StatStorageInfoComponent;
  let fixture: ComponentFixture<StatStorageInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StatStorageInfoComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StatStorageInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
