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
  positive: string;
  negative?: string;
  positiveStyle?: ButtonStyle = 'primary';

  constructor(public modal: NgbActiveModal) { }

  ngOnInit(): void {
  }

  static open(service: NgbModal, config: MessageDialogConfig): NgbModalRef {
    const ref = service.open(MessageDialogComponent, {
      centered: true
    });
    Object.assign(ref.componentInstance, config);
    return ref;
  }

}

type ButtonStyle = 'danger' | 'primary';

interface MessageDialogConfig {
  title?: string;
  message: string;
  positive: string | null;
  negative?: string | null;
  positiveStyle?: ButtonStyle;
}
