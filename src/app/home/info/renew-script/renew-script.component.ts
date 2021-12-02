import {Component, Inject, OnInit} from '@angular/core';
import {NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import {Device} from '../../../../types/novacom';
import {DeviceManagerService, ElectronService} from '../../../core/services';
import {BehaviorSubject, noop, Observable} from 'rxjs';
import {dialog, getCurrentWindow} from "@electron/remote";

@Component({
  selector: 'app-renew-script',
  templateUrl: './renew-script.component.html',
  styleUrls: ['./renew-script.component.scss']
})
export class RenewScriptComponent implements OnInit {

  public decryptedPrivKey: string;
  public devModeToken$: Observable<string>;

  constructor(
    private electron: ElectronService,
    public modal: NgbActiveModal,
    private deviceManager: DeviceManagerService,
    @Inject('device') public device: Device
  ) {
    const result: any = electron.ssh2.utils.parseKey(device.privateKey, device.passphrase);
    console.log(result);
    if (result.getPrivatePEM) {
      this.decryptedPrivKey = result.getPrivatePEM();
    }
    const subject = new BehaviorSubject<string>("");
    deviceManager.devModeToken(device.name).then(token => subject.next(token));
    this.devModeToken$ = subject.asObservable();
  }

  ngOnInit(): void {
  }

  copyScript(content: string): void {
    navigator.clipboard.writeText(content);
  }

  saveScript(content: string): void {
    dialog.showSaveDialog(getCurrentWindow(), {
      defaultPath: `renew-devmode-${this.device.name}.sh`
    }).then(value => {
      this.electron.fs.writeFileSync(value.filePath, content, { encoding: 'utf8', mode: 0o755 });
    }).catch(noop);
  }
}
