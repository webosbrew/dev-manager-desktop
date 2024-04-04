import {Component, NgZone} from '@angular/core';
import {NgbModal, NgbModalRef} from '@ng-bootstrap/ng-bootstrap';

@Component({
    selector: 'app-progress-dialog',
    templateUrl: './progress-dialog.component.html',
    styleUrls: ['./progress-dialog.component.scss']
})
export class ProgressDialogComponent {

    message?: string;
    progress?: number;

    constructor(private zone: NgZone) {
    }

    update(message?: string, progress?: number): void {
        this.zone.run(() => {
            this.message = message;
            this.progress = progress;
        });
    }

    static open(service: NgbModal): NgbModalRef {
        return service.open(ProgressDialogComponent, {
            centered: true,
            backdrop: 'static',
            keyboard: false
        });
    }
}
