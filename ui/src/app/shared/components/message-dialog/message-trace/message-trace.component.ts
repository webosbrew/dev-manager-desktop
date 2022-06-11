import {Component} from '@angular/core';

@Component({
  selector: 'app-message-trace',
  templateUrl: './message-trace.component.html',
  styleUrls: ['./message-trace.component.scss']
})
export class MessageTraceComponent {

  message: string = '';
  error: any;
  detailsExpanded: boolean = false;

  constructor() {
  }

}
