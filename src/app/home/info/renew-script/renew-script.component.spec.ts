import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RenewScriptComponent } from './renew-script.component';

describe('RenewScriptComponent', () => {
  let component: RenewScriptComponent;
  let fixture: ComponentFixture<RenewScriptComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RenewScriptComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RenewScriptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
