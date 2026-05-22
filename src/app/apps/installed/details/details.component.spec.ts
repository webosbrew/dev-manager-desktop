import {ComponentFixture, TestBed} from '@angular/core/testing';

import {DetailsComponent} from './details.component';
import {AppManagerService, PackageManifest, RepositoryItem} from '../../../core/services';
import {Device, PackageInfo} from '../../../types';
import {AppsComponent} from '../../apps.component';

describe('InstalledDetailsComponent', () => {
    let component: DetailsComponent;
    let fixture: ComponentFixture<DetailsComponent>;
    let parentSpy: jasmine.SpyObj<AppsComponent>;

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
        const appManagerStub = {
            appDiskUsage: () => Promise.reject(new Error('not under test')),
        } as Partial<AppManagerService>;

        TestBed.configureTestingModule({
            imports: [DetailsComponent],
            providers: [
                {provide: AppManagerService, useValue: appManagerStub},
            ],
        });

        fixture = TestBed.createComponent(DetailsComponent);
        component = fixture.componentInstance;
        component.pkg = pkg;
        component.device = device;
        component.parent = parentSpy;
        component.repoPackage = repoPackage;
        component.ngOnChanges({
            pkg: <any>{currentValue: pkg, previousValue: undefined, firstChange: true, isFirstChange: () => true},
            device: <any>{currentValue: device, previousValue: undefined, firstChange: true, isFirstChange: () => true},
        });
        fixture.detectChanges();
    }

    it('should create', () => {
        setup();
        expect(component).toBeTruthy();
    });

    it('Launch calls parent.launchApp', () => {
        setup();
        component.launch();
        expect(parentSpy.launchApp).toHaveBeenCalledWith(pkg.id);
    });

    it('Uninstall calls parent.removePackage with the package', async () => {
        setup();
        const removed = await component.uninstall();
        expect(parentSpy.removePackage).toHaveBeenCalledWith(pkg);
        expect(removed).toBeTrue();
    });

    it('Update calls parent.installPackage when a repo package is available', async () => {
        const newer = new RepositoryItem({manifest: new PackageManifest({version: '2.0.0'})}, '');
        setup(newer);
        const installed = await component.update();
        expect(parentSpy.installPackage).toHaveBeenCalledWith(newer);
        expect(installed).toBeTrue();
    });

    it('Update is a no-op without a repo package', async () => {
        setup(null);
        const installed = await component.update();
        expect(installed).toBeFalse();
        expect(parentSpy.installPackage).not.toHaveBeenCalled();
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
