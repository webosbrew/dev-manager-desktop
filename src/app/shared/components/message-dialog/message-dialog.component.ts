import { Component, OnInit } from '@angular/core';
import { NgbModal, NgbModalRef, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
@Component({
  selector: 'app-message-dialog',
  templateUrl: './message-dialog.component.html',
  styleUrls: ['./message-dialog.component.scss']
})
export class MessageDialogComponent implements OnInit, MessageDialogConfig {
  title: string;
  message: string;

  constructor(public modal: NgbActiveModal) { }

  ngOnInit(): void {
  }

  static open(service: NgbModal, config: MessageDialogConfig): NgbModalRef {
    const ref = service.open(MessageDialogComponent);
    Object.assign(ref.componentInstance, config);
    return ref;
  }

}

interface MessageDialogConfig {
  title?: string;
  message?: string;
}
