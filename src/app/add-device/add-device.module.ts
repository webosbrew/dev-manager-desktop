import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DeviceEditorComponent} from "./device-editor/device-editor.component";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {WizardComponent} from './wizard/wizard.component';
import {SharedModule} from "../shared/shared.module";
import {NgbAccordionModule, NgbCollapse, NgbNavModule, NgbTooltipModule} from "@ng-bootstrap/ng-bootstrap";
import {ModeSelectComponent} from './wizard/mode-select/mode-select.component';
import {DevmodeSetupComponent} from './wizard/devmode-setup/devmode-setup.component';
import {StepHeaderComponent} from './wizard/devmode-setup/step-header/step-header.component';
import {AddDeviceComponent} from "./wizard/add-device/add-device.component";
import {DevmodeComponent} from './wizard/add-device/devmode/devmode.component';


@NgModule({
  declarations: [
    DeviceEditorComponent,
    WizardComponent,
    ModeSelectComponent,
    AddDeviceComponent,
    DevmodeSetupComponent,
    StepHeaderComponent,
    DevmodeComponent,
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
  ]
})
export class AddDeviceModule {
}
