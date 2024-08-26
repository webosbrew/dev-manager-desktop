import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InlineEditorComponent } from './inline-editor.component';

describe('InlineEditorComponent', () => {
  let component: InlineEditorComponent;
  let fixture: ComponentFixture<InlineEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InlineEditorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InlineEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
