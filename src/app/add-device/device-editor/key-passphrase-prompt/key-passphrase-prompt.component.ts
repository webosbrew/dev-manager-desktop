import {Component, Inject, Injector} from '@angular/core';
import {NgbActiveModal, NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {FormControl, ValidationErrors} from "@angular/forms";
import {DeviceManagerService} from "../../../core/services";
import {Observable} from "rxjs";
import {BackendError} from "../../../core/services/backend-client";
import {fromPromise} from "rxjs/internal/observable/innerFrom";

@Component({
  selector: 'app-key-passphrase-prompt',
  templateUrl: './key-passphrase-prompt.component.html',
  styleUrls: ['./key-passphrase-prompt.component.scss']
})
export class KeyPassphrasePromptComponent {
  formControl: FormControl<string>;

  constructor(
    public modal: NgbActiveModal,
    private deviceManager: DeviceManagerService,
    @Inject('keyPath') private keyPath: string
  ) {
    this.formControl = new FormControl<string>('', {
      nonNullable: true,
      asyncValidators: (control) => this.verifySshKey(control.value)
    });
  }

  private verifySshKey(passphrase: string): Observable<null | ValidationErrors> {
    return fromPromise(this.deviceManager.verifyLocalPrivateKey(this.keyPath, passphrase).then(() => null).catch(e => {
      if (BackendError.isCompatibleBody(e)) {
        return {[e.reason]: true};
      }
      throw e;
    }));
  }

  static prompt(modals: NgbModal, keyPath: string): Promise<string | undefined> {
    const ref = modals.open(KeyPassphrasePromptComponent, {
      size: 'sm',
      centered: true,
      injector: Injector.create({
        providers: [
          {provide: 'keyPath', useValue: keyPath}
        ]
      })
    });
    return ref.result.catch(() => undefined);
  }
}
