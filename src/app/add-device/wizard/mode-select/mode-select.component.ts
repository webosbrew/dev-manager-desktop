import {Component, EventEmitter, Input, Output} from '@angular/core';

@Component({
  selector: 'app-wizard-mode-select',
  templateUrl: './mode-select.component.html',
  styleUrls: ['./mode-select.component.scss']
})
export class ModeSelectComponent {
  private modeValue: DeviceConnectionMode = DeviceConnectionMode.DevMode;

  @Output()
  public modeChange: EventEmitter<DeviceConnectionMode> = new EventEmitter();

  @Output()
  public proceed: EventEmitter<void> = new EventEmitter();

  get mode(): DeviceConnectionMode {
    return this.modeValue;
  }

  @Input()
  set mode(mode: DeviceConnectionMode) {
    this.modeValue = mode;
    this.modeChange.emit(mode);
  }
}

export enum DeviceConnectionMode {
  DevMode = 'devMode',
  Rooted = 'rooted',
  Advanced = 'advanced',
}
