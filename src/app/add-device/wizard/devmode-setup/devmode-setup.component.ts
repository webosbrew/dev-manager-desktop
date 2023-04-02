import {Component, EventEmitter, Output, ViewEncapsulation} from '@angular/core';

@Component({
  selector: 'app-wizard-devmode-setup',
  templateUrl: './devmode-setup.component.html',
  styleUrls: ['./devmode-setup.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class DevmodeSetupComponent {

  prepareAccountDone: boolean = false;
  installAppDone: boolean = false;
  enableDevModeDone: boolean = false;
  prepareSetupDone: boolean = false;

  @Output()
  proceed: EventEmitter<void> = new EventEmitter();

}
