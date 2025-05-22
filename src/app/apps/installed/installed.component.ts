import {Component, Host, Injector, OnDestroy, OnInit} from '@angular/core';
import {AppsComponent} from '../apps.component';
import {Device, PackageInfo} from "../../types";
import {Observable, Subscription} from "rxjs";
import {AppManagerService, DeviceManagerService, RepositoryItem} from "../../core/services";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {DetailsComponent as InstalledDetailsComponent} from "./details/details.component";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";

@Component({
    selector: 'app-installed',
    templateUrl: './installed.component.html',
    styleUrls: ['./installed.component.scss']
})
export class InstalledComponent implements OnInit, OnDestroy {

    device: Device | null = null;
    devices$?: Observable<Device[] | null>;
    installed$: Observable<PackageInfo[]> | undefined;

    installedError?: Error;

    repoPackages?: Record<string, RepositoryItem>;

    private subscription?: Subscription;

    constructor(@Host() public parent: AppsComponent, public deviceManager: DeviceManagerService,
                private appManager: AppManagerService, private modals: NgbModal) {
    }

    ngOnInit(): void {
        this.devices$ = this.deviceManager.devices$;
        this.subscription = this.devices$.subscribe(devices => {
            this.device = devices?.find(d => d.default) ?? null;
            this.loadPackages();
        });
    }

    ngOnDestroy(): void {
        this.subscription?.unsubscribe();
    }

    loadPackages(): void {
        const device = this.device;
        if (!device) return;
        this.installedError = undefined;
        this.installed$ = fromPromise(this.appManager.load(device));
    }

    openDetails(pkg: PackageInfo) {
        this.modals.open(InstalledDetailsComponent, {
            size: 'lg',
            scrollable: true,
            injector: Injector.create({
                providers: [
                    {provide: 'package', useValue: pkg},
                    {provide: 'device', useValue: this.device},
                ]
            })
        });
    }
}
