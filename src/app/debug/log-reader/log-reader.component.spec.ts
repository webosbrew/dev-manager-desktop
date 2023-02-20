import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogReaderComponent } from './log-reader.component';

describe('ReaderComponent', () => {
  let component: LogReaderComponent;
  let fixture: ComponentFixture<LogReaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LogReaderComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LogReaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
