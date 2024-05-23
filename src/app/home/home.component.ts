import {Component, ElementRef, HostListener, Injector, OnInit, ViewChild} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {Device} from '../types';
import {DeviceManagerService} from '../core/services';
import {RemoveConfirmation, RemoveDeviceComponent} from "../remove-device/remove-device.component";
import packageInfo from '../../../package.json';
import {WizardComponent} from "../add-device/wizard/wizard.component";
import {noop} from "rxjs";
import {filter} from "rxjs/operators";
import {isNonNull} from "../shared/operators";
import ReleaseInfo from '../../release.json';
import {DeviceChooserComponent} from "./device-chooser/device-chooser.component";

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

    selectedDevice?: Device;
    appVersion: string;
    @ViewChild('appNav', {static: true})
    appNav?: ElementRef<HTMLElement>;
    appNavTooltipDirection: string = 'right';

    constructor(
        public deviceManager: DeviceManagerService,
        private modalService: NgbModal
    ) {
        deviceManager.devices$.pipe(filter(isNonNull)).subscribe((devices) => {
            this.selectedDevice = devices.find((device) => device.default) || devices[0];
            if (!this.selectedDevice) {
                this.openSetupDevice(false);
            }
        });
        this.appVersion = ReleaseInfo.version || packageInfo.version;
    }

    async removeDevice(device: Device): Promise<void> {
        let answer: RemoveConfirmation;
        try {
            let a = await RemoveDeviceComponent.confirm(this.modalService, device);
            if (!a) {
                return;
            }
            answer = a;
        } catch (e) {
            return;
        }
        await this.deviceManager.removeDevice(device.name, answer.deleteSshKey);
    }

    markDefault(device: Device): void {
        this.deviceManager.setDefault(device.name).catch(reason => {
            console.log(reason);
        });
    }

    openSetupDevice(cancellable: boolean): void {
        const ref = this.modalService.open(WizardComponent, {
            size: 'xl', centered: true, scrollable: true,
            injector: Injector.create({
                providers: [
                    {provide: 'cancellable', useValue: cancellable}
                ]
            }),
            beforeDismiss: () => cancellable,
        });
        ref.result.then((device) => this.deviceManager.setDefault(device.name)).catch(noop);
    }

    defaultDragOver(event: DragEvent): void {
        event.preventDefault();
    }

    defaultDragEnter(event: DragEvent): void {
        const transfer = event.dataTransfer!;
        if (transfer.items.length != 1 || transfer.items[0].kind != 'file') {
            return;
        }
        event.preventDefault();
        console.log('defaultDragEnter', event.type, transfer.items.length && transfer.items[0]);
    }

    defaultDragLeave(event: DragEvent): void {
        const dataTransfer = event.dataTransfer!;
        console.log('defaultDragLeave', dataTransfer.items.length && dataTransfer.items[0]);
    }

    defaultDrop(event: DragEvent): boolean {
        console.log('defaultDrop', event);
        event.stopPropagation();
        event.preventDefault();
        return false;
    }

    openDeviceChooser(): void {
        this.modalService.open(DeviceChooserComponent, {
            size: 'sm',
            centered: true,
        }).result.then((device) => this.markDefault(device)).catch(noop);
    }

    ngOnInit(): void {
        this.updateTooltipDirection();
    }

    @HostListener('window:resize')
    onResize(): void {
        this.updateTooltipDirection();
    }

    private updateTooltipDirection(): void {
        const flexDirection = this.appNav?.nativeElement?.computedStyleMap().get('flex-direction');
        if (!(flexDirection instanceof CSSKeywordValue)) {
            return;
        }
        this.appNavTooltipDirection = flexDirection.value === 'row' ? 'top' : 'right';
    }
}
