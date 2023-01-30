import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilesTableComponent } from './files-table.component';

describe('FilesTableComponent', () => {
  let component: FilesTableComponent;
  let fixture: ComponentFixture<FilesTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FilesTableComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FilesTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
