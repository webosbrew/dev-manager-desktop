import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import {EMPTY, of} from 'rxjs';

import {DetailsComponent} from './details.component';
import {AppManagerService, PackageManifest, RepositoryItem} from '../../../core/services';
import {Device, PackageInfo} from '../../../types';
import {AppsComponent} from '../../apps.component';

describe('InstalledDetailsComponent', () => {
    let component: DetailsComponent;
    let fixture: ComponentFixture<DetailsComponent>;
    let parentSpy: jasmine.SpyObj<AppsComponent>;
    let modalSpy: jasmine.SpyObj<NgbActiveModal>;

    const device: Device = <Device>{
        name: 'test', host: '192.168.1.1', port: 22, username: 'prisoner',
        profile: 'ose', privateKey: {openSsh: 'test'},
    };
    const pkg: PackageInfo = <PackageInfo>{
        id: 'com.example.app', title: 'Example', version: '1.0.0',
        folderPath: '/media/developer/apps/usr/palm/applications/com.example.app',
        iconUri: '', appDescription: '',
    };

    function setup(repoPackage: RepositoryItem | null = null) {
        parentSpy = jasmine.createSpyObj<AppsComponent>('AppsComponent', ['launchApp', 'removePackage', 'installPackage']);
        parentSpy.removePackage.and.resolveTo(true);
        parentSpy.installPackage.and.resolveTo(true);
        modalSpy = jasmine.createSpyObj<NgbActiveModal>('NgbActiveModal', ['close', 'dismiss']);
        const appManagerStub = {
            appDiskUsage: () => Promise.reject(new Error('not under test')),
        } as Partial<AppManagerService>;

        TestBed.configureTestingModule({
            imports: [DetailsComponent],
            providers: [
                {provide: 'device', useValue: device},
                {provide: 'package', useValue: pkg},
                {provide: 'parent', useValue: parentSpy},
                {provide: 'repoPackage', useValue: repoPackage},
                {provide: NgbActiveModal, useValue: modalSpy},
                {provide: AppManagerService, useValue: appManagerStub},
            ],
        });

        fixture = TestBed.createComponent(DetailsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }

    it('should create', () => {
        setup();
        expect(component).toBeTruthy();
    });

    it('Launch calls parent.launchApp and closes the modal', () => {
        setup();
        component.launch();
        expect(parentSpy.launchApp).toHaveBeenCalledWith(pkg.id);
        expect(modalSpy.close).toHaveBeenCalled();
    });

    it('Uninstall calls parent.removePackage and closes the modal on success', async () => {
        setup();
        await component.uninstall();
        expect(parentSpy.removePackage).toHaveBeenCalledWith(pkg);
        expect(modalSpy.close).toHaveBeenCalled();
    });

    it('Uninstall keeps the modal open when removePackage returns false', async () => {
        setup();
        parentSpy.removePackage.and.resolveTo(false);
        await component.uninstall();
        expect(modalSpy.close).not.toHaveBeenCalled();
    });

    it('hasUpdate is false when no repo package is provided', () => {
        setup(null);
        expect(component.hasUpdate).toBeFalse();
    });

    it('hasUpdate reflects the repo manifest comparison', () => {
        const newer = new RepositoryItem({manifest: new PackageManifest({version: '2.0.0'})}, '');
        setup(newer);
        expect(component.hasUpdate).toBeTrue();
    });
});
