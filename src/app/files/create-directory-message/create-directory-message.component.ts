import {Component} from '@angular/core';
import {MessageDialogComponent} from "../../shared/components/message-dialog/message-dialog.component";
import {FormControl, Validators} from "@angular/forms";

@Component({
  selector: 'app-create-directory-message',
  templateUrl: './create-directory-message.component.html',
  styleUrls: ['./create-directory-message.component.scss']
})
export class CreateDirectoryMessageComponent {
  public formControl: FormControl<string>;

  constructor(private parent: MessageDialogComponent) {
    this.formControl = new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/^[^\\/:*?"<>|]+$/),
        Validators.pattern(/[^.]$/)
      ]
    });
    this.formControl.statusChanges.subscribe((v) => {
      parent.positiveDisabled = v !== 'VALID';
    });
    parent.positiveDisabled = this.formControl.invalid;
    parent.positiveAction = () => this.formControl.value;
  }
}
