import {NgModule} from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';
import {DeviceEditorComponent} from "./device-editor/device-editor.component";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {WizardComponent} from './wizard/wizard.component';
import {SharedModule} from "../shared/shared.module";
import {NgbAccordionModule, NgbCollapse, NgbNavModule, NgbTooltipModule} from "@ng-bootstrap/ng-bootstrap";
import {ModeSelectComponent} from './wizard/mode-select/mode-select.component';
import {DevmodeSetupComponent} from './wizard/devmode-setup/devmode-setup.component';
import {StepHeaderComponent} from './wizard/devmode-setup/step-header/step-header.component';
import {AddDeviceComponent} from "./wizard/add-device/add-device.component";
import {SshAuthValueDirective} from './device-editor/ssh-auth-value.directive';
import {KeyPassphrasePromptComponent} from './device-editor/key-passphrase-prompt/key-passphrase-prompt.component';
import {
  DevmodePassphraseHintComponent
} from './device-editor/devmode-passphrase-hint/devmode-passphrase-hint.component';
import {SshPrivkeyHintComponent} from './device-editor/ssh-privkey-hint/ssh-privkey-hint.component';
import {SshPasswordHintComponent} from './device-editor/ssh-password-hint/ssh-password-hint.component';
import { RetryFailedComponent } from './retry-failed/retry-failed.component';


@NgModule({
  declarations: [
    DeviceEditorComponent,
    WizardComponent,
    ModeSelectComponent,
    AddDeviceComponent,
    DevmodeSetupComponent,
    StepHeaderComponent,
    SshAuthValueDirective,
    KeyPassphrasePromptComponent,
    DevmodePassphraseHintComponent,
    SshPrivkeyHintComponent,
    SshPasswordHintComponent,
    RetryFailedComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SharedModule,
    NgbNavModule,
    NgbAccordionModule,
    NgbTooltipModule,
    FormsModule,
    NgbCollapse,
    NgOptimizedImage,
  ]
})
export class AddDeviceModule {
}
