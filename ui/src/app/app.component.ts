import {Component} from '@angular/core';
import {DeviceManagerService, Release, UpdateService} from './core/services';
import PackageInfo from '../../../package.json';
import {SemVer} from 'semver';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {MessageDialogComponent} from './shared/components/message-dialog/message-dialog.component';
import {UpdateDetailsComponent} from './update-details/update-details.component';
import {shell} from "@electron/remote";
import {ThemeService} from "ng-bootstrap-darkmode";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  constructor(
    private update: UpdateService,
    private modalService: NgbModal,
    private deviceManager: DeviceManagerService,
    private themeService: ThemeService
  ) {
    update.getRecentRelease().then(async info => {
      let curVer = new SemVer(PackageInfo.version, true);
      const until = update.ignoreUntil;
      if (until && curVer.compare(until) < 0) {
        curVer = new SemVer(until, true);
      }
      const remoteVer = new SemVer(info.tag_name, true);
      if (remoteVer.compare(curVer) > 0) {
        await this.notifyUpdate(info, remoteVer);
      }
    });
    deviceManager.load();
    themeService.theme = 'auto';
  }

  private async notifyUpdate(info: Release, version: SemVer): Promise<void> {
    return MessageDialogComponent.open(this.modalService, {
      title: `Update ${version.version} is available`,
      message: UpdateDetailsComponent,
      negative: 'Next time',
      positive: 'More info',
      alternative: 'Ignore this version',
      messageExtras: {release: info}
    }).result.then((result: boolean | null) => {
      switch (result) {
        case true: {
          shell.openExternal(info.html_url);
          break;
        }
        case false: {
          break;
        }
        case null: {
          this.update.ignoreUntil = version;
          break;
        }
      }
    });
  }

}
