import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {Device} from "../../types";
import {RemoteCommandService} from "../../core/services/remote-command.service";
import {noop, Observable, Subscription, tap} from "rxjs";

@Component({
  selector: 'app-log-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.scss']
})
export class MessagesComponent implements OnDestroy {

  logs: string[] = [];

  private deviceField: Device | null = null;
  private subscription?: Subscription;

  constructor(private cmd: RemoteCommandService) {
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get device(): Device | null {
    return this.deviceField;
  }

  @Input()
  set device(device: Device | null) {
    this.deviceField = device;
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    this.logs = [];
    if (device) {
      this.reload(device).catch(noop);
    }
  }

  private async reload(device: Device): Promise<void> {
    this.subscription = (await this.logread(device)).subscribe((row) => {
      this.logs.push(row);
    });
  }

  private async logread(device: Device) {
    return await this.cmd.popen(device, 'tail -f /var/log/messages', 'utf-8');
  }
}
