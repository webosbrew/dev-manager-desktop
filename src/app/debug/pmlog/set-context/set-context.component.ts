import {Component} from '@angular/core';
import {NgbActiveModal, NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {UntypedFormBuilder, UntypedFormGroup} from "@angular/forms";
import {LOG_LEVELS} from "../control/control.component";
import {PrefLogLevel} from "../../../core/services/remote-log.service";

@Component({
  selector: 'app-pmlog-set-context',
  templateUrl: './set-context.component.html',
  styleUrls: ['./set-context.component.scss']
})
export class SetContextComponent {
  public formGroup: UntypedFormGroup;
  public logLevels = LOG_LEVELS;

  constructor(public modal: NgbActiveModal, fb: UntypedFormBuilder) {
    this.formGroup = fb.group({
      context: [''],
      level: ['none'],
    })
  }

  public static async prompt(modals: NgbModal): Promise<SetContextResult> {
    return modals.open(SetContextComponent).result;
  }

}

export declare class SetContextResult {
  context: string;
  level: PrefLogLevel;
}
