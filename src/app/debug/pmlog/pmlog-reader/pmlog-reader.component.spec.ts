import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PmLogReaderComponent } from './pmlog-reader.component';

describe('ReaderComponent', () => {
  let component: PmLogReaderComponent;
  let fixture: ComponentFixture<PmLogReaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PmLogReaderComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PmLogReaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
