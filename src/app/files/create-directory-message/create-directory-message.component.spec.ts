import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateDirectoryMessageComponent } from './create-directory-message.component';

describe('CreateDirectoryMessageComponent', () => {
  let component: CreateDirectoryMessageComponent;
  let fixture: ComponentFixture<CreateDirectoryMessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CreateDirectoryMessageComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateDirectoryMessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
