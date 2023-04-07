import {Component, Inject, OnInit} from '@angular/core';
import {NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import {Device} from '../../types';
import {DeviceManagerService, DevModeService} from '../../core/services';
import {noop} from 'rxjs';
import {save as showSaveDialog} from '@tauri-apps/api/dialog'
import {writeTextFile} from '@tauri-apps/api/fs';

@Component({
  selector: 'app-renew-script',
  templateUrl: './renew-script.component.html',
  styleUrls: ['./renew-script.component.scss']
})
export class RenewScriptComponent implements OnInit {

  public privKeyContent?: string;
  public devModeToken?: string;

  constructor(
    public modal: NgbActiveModal,
    private deviceManager: DeviceManagerService,
    private devMode: DevModeService,
    @Inject('device') public device: Device
  ) {
  }

  ngOnInit(): void {
    this.devMode.status(this.device).then(({token}) => this.devModeToken = token);
    this.deviceManager.readPrivKey(this.device).then(key => this.privKeyContent = key);
  }

  async copyScript(content: string): Promise<void> {
    await navigator.clipboard.writeText(content);
  }

  saveScript(content: string): void {
    showSaveDialog({
      defaultPath: `renew-devmode-${this.device.name}.sh`
    }).then(value => {
      if (!value) {
        return;
      }
      return writeTextFile(value, content);
    }).catch(noop);
  }
}
