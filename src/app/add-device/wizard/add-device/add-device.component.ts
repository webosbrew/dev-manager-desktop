import {Component, Input, OnInit, ViewChild} from '@angular/core';
import {DeviceConnectionMode} from "../mode-select/mode-select.component";
import {NewDevice, NewDeviceAuthentication} from "../../../types";
import {DeviceEditorComponent} from "../../device-editor/device-editor.component";

@Component({
  selector: 'app-wizard-add-device',
  templateUrl: './add-device.component.html',
  styleUrls: ['./add-device.component.scss']
})
export class AddDeviceComponent implements OnInit {
  @Input()
  mode!: DeviceConnectionMode;

  @ViewChild('deviceEditor')
  deviceEditor!: DeviceEditorComponent;

  username?: string;
  port?: number;
  auth?: NewDeviceAuthentication;

  ngOnInit(): void {
    switch (this.mode) {
      case DeviceConnectionMode.DevMode: {
        this.username = 'prisoner';
        this.port = 9922;
        this.auth = 'devKey';
        break;
      }
      case DeviceConnectionMode.Rooted: {
        this.username = 'root';
        this.port = 22;
        this.auth = 'localKey';
        break;
      }
    }
  }

  addDevice(): Promise<NewDevice> {
    return this.deviceEditor.submit();
  }
}
