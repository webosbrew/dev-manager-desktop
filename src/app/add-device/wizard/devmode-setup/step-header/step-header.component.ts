import {Component, EventEmitter, Input, Output} from '@angular/core';

@Component({
  selector: 'app-devmode-setup-step-header',
  templateUrl: './step-header.component.html',
  styleUrls: ['./step-header.component.scss']
})
export class StepHeaderComponent {
  private checked: boolean = false;

  @Input()
  id: string = '';

  @Input()
  title: string = '';

  @Output()
  doneChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  get done(): boolean {
    return this.checked;
  }

  @Input()
  set done(done: boolean) {
    this.checked = done;
    this.doneChange.emit(done);
  }
}
