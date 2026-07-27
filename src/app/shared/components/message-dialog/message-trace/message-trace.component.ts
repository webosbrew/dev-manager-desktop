import {Component, ChangeDetectionStrategy} from '@angular/core';

@Component({
    selector: 'app-message-trace',
    templateUrl: './message-trace.component.html',
    styleUrls: ['./message-trace.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class MessageTraceComponent {

  message: string = '';
  error: any;
  detailsCollapsed: boolean = true;

  constructor() {
  }

}
