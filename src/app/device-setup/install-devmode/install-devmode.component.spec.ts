import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstallDevmodeComponent } from './install-devmode.component';

describe('InstallDevmodeComponent', () => {
  let component: InstallDevmodeComponent;
  let fixture: ComponentFixture<InstallDevmodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InstallDevmodeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InstallDevmodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
