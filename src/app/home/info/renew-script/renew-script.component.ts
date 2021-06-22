import { Component, Inject, OnInit } from '@angular/core';
import { Device } from '../../../../types/novacom';
import { ElectronService } from '../../../core/services';

@Component({
  selector: 'app-renew-script',
  templateUrl: './renew-script.component.html',
  styleUrls: ['./renew-script.component.scss']
})
export class RenewScriptComponent implements OnInit {

  public decryptedPrivKey: string;

  constructor(
    electron: ElectronService,
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

}
