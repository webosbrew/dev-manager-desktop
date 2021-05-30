import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-message-trace',
  templateUrl: './message-trace.component.html',
  styleUrls: ['./message-trace.component.scss']
})
export class MessageTraceComponent implements OnInit {

  message: string;
  error: any;

  constructor() { }

  ngOnInit(): void {
  }

}
