import {
    AfterContentChecked,
    ChangeDetectorRef,
    Component,
    Inject,
    OnDestroy,
    OnInit,
    TemplateRef,
    ViewChild
} from '@angular/core';
import {DeviceConnectionMode} from "./mode-select/mode-select.component";
import {NgbActiveModal, NgbNav} from "@ng-bootstrap/ng-bootstrap";
import {Subscription} from "rxjs";
import {Device} from "../../types";
import {findIndex} from "lodash-es";

@Component({
    selector: 'app-wizard',
    templateUrl: './wizard.component.html',
    styleUrls: ['./wizard.component.scss']
})
export class WizardComponent implements OnInit, AfterContentChecked, OnDestroy {
    connectionMode: DeviceConnectionMode = DeviceConnectionMode.DevMode;
    activateId: string = 'mode-select';

    @ViewChild('nav', {static: true})
    ngbNav!: NgbNav;


    navTitle?: string;

    footerTemplate: TemplateRef<any> | null = null;

    private subscriptions = new Subscription();

    constructor(@Inject('cancellable') public cancellable: boolean, public modal: NgbActiveModal,
                private changeDetector: ChangeDetectorRef) {
    }

    ngOnInit(): void {
        this.subscriptions.add(this.ngbNav.navItemChange$.subscribe((item) => {
            return this.navTitle = this.findNavTitle(item?.id);
        }));
    }

    ngAfterContentChecked(): void {
        if (!this.navTitle) {
            this.navTitle = this.findNavTitle(this.ngbNav.activeId);
        }
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }

    @ViewChild('footerTemplate')
    set footerTemplateAssigned(ref: TemplateRef<any> | null) {
        this.footerTemplate = ref;
        this.changeDetector.detectChanges();
    }

    finishConnectionModeSelection(): void {
        switch (this.connectionMode) {
            case DeviceConnectionMode.DevMode:
                this.activateId = 'devmode-setup';
                break;
            default:
                this.editDevice();
                break;
        }
    }

    editDevice(): void {
        this.activateId = 'device-info';
    }

    prevStep(): void {
        const items = this.ngbNav.items?.toArray();
        if (!items) {
            return;
        }
        const index = findIndex(items, (item) => item.active);
        if (index <= 0) {
            return;
        }
        this.activateId = items[index - 1].id;
    }

    deviceAdded(newDevice: Device): void {
        this.modal.close(newDevice);
    }

    private findNavTitle(id: string): string | undefined {
        const activeLink = this.ngbNav.links?.find((item) => item.navItem.id === id);
        const linkElem: HTMLElement | undefined = activeLink?.elRef?.nativeElement;
        return linkElem?.innerText;
    }

}
