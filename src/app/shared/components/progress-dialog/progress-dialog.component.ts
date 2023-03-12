import {Component} from '@angular/core';
import {NgbModal, NgbModalRef} from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-progress-dialog',
  templateUrl: './progress-dialog.component.html',
  styleUrls: ['./progress-dialog.component.scss']
})
export class ProgressDialogComponent {

  message?: string;
  progress?: number;

  constructor() {
  }

  static open(service: NgbModal): NgbModalRef {
    const ref = service.open(ProgressDialogComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false
    });
    return ref;
  }
}
