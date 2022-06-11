import {Component, OnInit} from '@angular/core';
import {NgbModal, NgbModalRef} from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-progress-dialog',
  templateUrl: './progress-dialog.component.html',
  styleUrls: ['./progress-dialog.component.scss']
})
export class ProgressDialogComponent implements OnInit {

  constructor() {
  }

  ngOnInit(): void {
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
