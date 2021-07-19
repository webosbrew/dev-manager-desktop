import { Component, Inject, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Device } from '../../../../types/novacom';
import { ElectronService } from '../../../core/services';
import { noop } from 'rxjs';

@Component({
  selector: 'app-renew-script',
  templateUrl: './renew-script.component.html',
  styleUrls: ['./renew-script.component.scss']
})
export class RenewScriptComponent implements OnInit {

  public decryptedPrivKey: string;

  constructor(
    private electron: ElectronService,
    public modal: NgbActiveModal,
    @Inject('device') public device: Device
  ) {
    const result: any = electron.ssh2.utils.parseKey(device.privateKey, device.passphrase);
    console.log(result);
    if (result.getPrivatePEM) {
      this.decryptedPrivKey = result.getPrivatePEM();
    }
  }

  ngOnInit(): void {
  }

  copyScript(content: string): void {
    navigator.clipboard.writeText(content);
  }

  saveScript(content: string): void {
    const wnd = this.electron.remote.BrowserWindow.getFocusedWindow();
    this.electron.remote.dialog.showSaveDialog(wnd, {
      defaultPath: `renew-devmode-${this.device.name}.sh`
    }).then(value => {
      this.electron.fs.writeFileSync(value.filePath, content, { encoding: 'utf8', mode: 0o755 });
    }).catch(noop);
  }
}
