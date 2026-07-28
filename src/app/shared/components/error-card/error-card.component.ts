import {Component, EventEmitter, Input, Output, ChangeDetectionStrategy} from '@angular/core';

@Component({
    selector: 'app-error-card',
    templateUrl: './error-card.component.html',
    styleUrls: ['./error-card.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ErrorCardComponent {
  @Input()
  title?: string;

  @Input()
  error!: Error;

  @Output()
  retry: EventEmitter<void> = new EventEmitter<void>();

}
