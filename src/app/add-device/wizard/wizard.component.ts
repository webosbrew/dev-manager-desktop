import {AfterContentChecked, Component, Inject, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {DeviceConnectionMode} from "./mode-select/mode-select.component";
import {NgbActiveModal, NgbNav} from "@ng-bootstrap/ng-bootstrap";
import {Subscription} from "rxjs";
import {Device} from "../../types";

@Component({
  selector: 'app-wizard',
  templateUrl: './wizard.component.html',
  styleUrls: ['./wizard.component.scss']
})
export class WizardComponent implements OnInit, AfterContentChecked, OnDestroy {
  connectionMode: DeviceConnectionMode = DeviceConnectionMode.Rooted;
  activateId: string = 'mode-select';

  @ViewChild('nav', {static: true})
  ngbNav!: NgbNav;
  navTitle?: string;


  private subscriptions = new Subscription();

  constructor(@Inject('cancellable') public cancellable: boolean, public modal: NgbActiveModal) {
  }

  ngOnInit(): void {
    this.subscriptions.add(this.ngbNav.navItemChange$.subscribe((item) => {
      return this.navTitle = this.findNavTitle(item?.id);
    }))
  }

  ngAfterContentChecked(): void {
    if (!this.navTitle) {
      this.navTitle = this.findNavTitle(this.ngbNav.activeId);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private findNavTitle(id: string): string | undefined {
    const activeLink = this.ngbNav.links?.find((item) => item.navItem.id === id);
    const linkElem: HTMLElement | undefined = activeLink?.elRef?.nativeElement;
    return linkElem?.innerText;
  }


  finishConnectionModeSelection(): void {
    switch (this.connectionMode) {
      case DeviceConnectionMode.DevMode:
        this.activateId = 'devmode-setup';
        break;
      case DeviceConnectionMode.Rooted:
        this.editDevice();
        break;
      case DeviceConnectionMode.Advanced:
        break;
    }
  }

  editDevice(): void {
    this.activateId = 'device-info';
  }

  deviceAdded(newDevice: Device): void {
    this.modal.close(newDevice);
  }
}
