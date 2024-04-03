import {Injectable} from '@angular/core';
import {BehaviorSubject, catchError, firstValueFrom, lastValueFrom, mergeMap, noop, Observable, Subject} from 'rxjs';
import {Device, PackageInfo, RawPackageInfo} from '../../types';
import {
    LunaResponse,
    LunaResponseError,
    LunaServiceNotFoundError,
    LunaUnknownMethodError,
    RemoteLunaService
} from "./remote-luna.service";
import {RemoteCommandService} from "./remote-command.service";
import {filter, map} from "rxjs/operators";
import * as path from "path";
import {RemoteFileService, ServeInstance} from "./remote-file.service";
import {IncompatibleReason, PackageManifest, RepositoryItem} from "./apps-repo.service";
import {fromPromise} from "rxjs/internal/observable/innerFrom";
import {LocalFileService} from "./local-file.service";
import _ from "lodash-es";
import {APP_ID_HBCHANNEL} from "../../shared/constants";
import {DeviceManagerService} from "./device-manager.service";
import {HomebrewChannelConfiguration} from "../../types/luna-apis";

@Injectable({
    providedIn: 'root'
})
export class AppManagerService {

    private packagesSubjects: Map<string, Subject<PackageInfo[] | null>>;

    constructor(private luna: RemoteLunaService, private cmd: RemoteCommandService, private file: RemoteFileService,
                private localFile: LocalFileService, private deviceManager: DeviceManagerService) {
        this.packagesSubjects = new Map();
    }

    packages$(device: Device): Observable<PackageInfo[] | null> {
        return this.obtainSubject(device);
    }

    async load(device: Device): Promise<PackageInfo[]> {
        const subject = this.obtainSubject(device);
        return this.list(device)
            .then(pkgs => {
                subject.next(pkgs);
                return pkgs;
            })
            .catch((error: any) => {
                subject.error(error);
                this.packagesSubjects.delete(device.name);
                return [];
            });
    }

    async list(device: Device): Promise<PackageInfo[]> {
        return this.luna.call(device, 'luna://com.webos.applicationManager/dev/listApps')
            .catch((e) => {
                if (e instanceof LunaUnknownMethodError) {
                    return this.luna.call(device, 'luna://com.webos.applicationManager/listApps', undefined, false);
                }
                throw e;
            })
            .then(resp => resp['apps'] as RawPackageInfo[])
            .then((result) => Promise.all(result.map(item => this.completeIcon(device, item))));
    }

    private async completeIcon(device: Device, info: RawPackageInfo): Promise<PackageInfo> {
        const data = await this.file.read(device, path.join(info.folderPath, info.icon))
            .then(d => d.length > 0 ? d : undefined)
            .catch((e) => {
                console.warn('failed to fetch app icon', e);
                return undefined;
            });
        return {iconUri: data && `data:application/octet-stream;base64,${data.toString('base64')}`, ...info}
    }

    async info(device: Device, id: string): Promise<PackageInfo | null> {
        return firstValueFrom(this.obtainSubject(device))
            .then(l => l ?? this.load(device))
            .then(l => l.find(p => p.id === id) ?? null);
    }

    async installByPath(device: Device, localPath: string, progress?: InstallProgressHandler): Promise<void> {
        const hasHbChannel = await this.deviceManager.getHbChannelConfig(device).then(() => true)
            .catch(() => false);
        if (hasHbChannel) {
            const sha256 = await this.localFile.checksum(localPath, 'sha256');
            const serve: ServeInstance = await this.file.serveLocal(device, localPath);
            console.log('Installing', serve.host);
            try {
                await this.hbChannelInstall(device, new URL(serve.host).toString(), sha256, progress);
            } finally {
                await serve.interrupt();
            }
        } else {
            const ipkPath = await this.tempDownloadIpk(device, localPath, progress);
            try {
                await this.devInstall(device, ipkPath, progress);
            } finally {
                await this.file.rm(device, ipkPath, false);
            }
        }
        this.load(device).catch(noop);
    }

    async installByManifest(device: Device, manifest: PackageManifest, progress?: InstallProgressHandler): Promise<void> {
        const hasHbChannel = await this.deviceManager.getHbChannelConfig(device).then(() => true)
            .catch(() => false);
        if (hasHbChannel) {
            try {
                await this.hbChannelInstall(device, manifest.ipkUrl, manifest.ipkHash?.sha256, progress);
                await this.load(device).catch(noop);
                return;
            } catch (e) {
                // Never attempt to do default install, if we are reinstalling hbchannel
                if (e instanceof InstallError || manifest.id === APP_ID_HBCHANNEL) {
                    throw e;
                }
            }
        }
        const path = await this.tempDownloadIpk(device, new URL(manifest.ipkUrl), progress);
        await this.devInstall(device, path, progress)
            .then(() => this.load(device).catch(noop))
            .finally(() => this.file.rm(device, path, false));
    }

    async remove(device: Device, id: string): Promise<void> {
        const luna = await this.luna.subscribe(device, 'luna://com.webos.appInstallService/dev/remove', {
            id, subscribe: true,
        });
        await lastValueFrom(luna.asObservable().pipe(
            map(v => mapAppinstalldResponse(v, /removed/i)),
            filter(v => v)/* Only pick finish event */,
            mergeMap(() => luna.unsubscribe()) /* Unsubscribe when done */,
            catchError((e) => fromPromise(luna.unsubscribe().then(() => {
                throw e;
            })))/* Unsubscribe when failed, and throw the error */)
        );
        await this.load(device);
    }

    async launch(device: Device, appId: string, params?: Record<string, any>): Promise<void> {
        await this.luna.call(device, 'luna://com.webos.applicationManager/launch', {
            id: appId, subscribe: false, params
        }, true);
    }

    async checkIncompatibility(device: Device, item: RepositoryItem): Promise<IncompatibleReason[] | null> {
        return Promise.all([
            this.deviceManager.getDeviceInfo(device).catch(() => undefined),
            this.deviceManager.getHbChannelConfig(device).catch((e): Partial<HomebrewChannelConfiguration> | undefined => {
                if (e instanceof LunaServiceNotFoundError) {
                    return {root: false};
                }
                return undefined;
            })
        ]).then(([info, hbConfig]) => item.checkIncompatibility(info, hbConfig));
    }

    async findInstallLocation(device: Device, id: string): Promise<'developer' | 'cryptofs' | 'system' | null> {
        if (device.username === 'root') {
            type AppInfo = { appInfo: { folderPath: string; systemApp?: boolean; } };
            return this.luna.call<AppInfo>(device, 'luna://com.webos.service.applicationManager/getAppInfo',
                {id}, false, true).then(info => {
                if (info.appInfo.systemApp) {
                    return 'system';
                } else if (info.appInfo.folderPath.startsWith('/media/developer/')) {
                    return 'developer';
                } else {
                    return 'cryptofs';
                }
            }).catch(() => null);
        } else {
            const appInfo = await this.info(device, id);
            // App can be found in developer mode partition
            if (appInfo) {
                return 'developer';
            }
            // App exists, so it must be in cryptofs
            type AppLoadStatus = { exist: boolean };
            const status = await this.luna.call<AppLoadStatus>(device,
                'luna://com.webos.service.applicationManager/getAppLoadStatus', {appId: id}, true, true)
                .catch(async (e): Promise<AppLoadStatus> => {
                    if (e instanceof LunaUnknownMethodError) {
                        // We have no way but to try launching the app
                        return this.launch(device, id).then(() => ({exist: true}))
                            .catch(() => ({exist: false}));
                    }
                    return ({exist: false});
                });
            if (status.exist) {
                return 'cryptofs';
            }
            return null;
        }
    }

    private obtainSubject(device: Device): Subject<PackageInfo[] | null> {
        let subject = this.packagesSubjects.get(device.name);
        if (!subject) {
            subject = new BehaviorSubject<PackageInfo[] | null>(null);
            this.packagesSubjects.set(device.name, subject);
        }
        return subject;
    }

    private async tempDownloadIpk(device: Device, location: string | URL, progress?: InstallProgressHandler): Promise<string> {
        const targetPath = `/tmp/devman_dl_${Date.now()}.ipk`
        let localPath: string;
        let deleteLocal = false;
        switch (typeof location) {
            case 'string': {
                localPath = location;
                break;
            }
            default: {
                localPath = await this.localFile.tempPath('.ipk');
                deleteLocal = true;
                progress?.(undefined, 'Downloading IPK to computer...');
                await this.localFile.download(location.toString(), localPath);
                break;
            }
        }
        progress?.(undefined, 'Sending IPK to device...');
        await this.file.put(device, targetPath, localPath).finally(() =>
            deleteLocal && this.localFile.remove(localPath).catch(noop));
        return targetPath;
    }

    private async devInstall(device: Device, path: string, progress?: InstallProgressHandler): Promise<void> {
        const luna = await this.luna.subscribe(device, 'luna://com.webos.appInstallService/dev/install', {
            id: 'com.ares.defaultName',
            ipkUrl: path,
            subscribe: true,
        });
        await lastValueFrom(luna.asObservable().pipe(
            map(v => mapAppinstalldResponse(v, /installed/i)),
            filter(v => v)/* Only pick finish event */,
            mergeMap(() => luna.unsubscribe()) /* Unsubscribe when done */,
            catchError((e) => fromPromise(luna.unsubscribe().then(() => {
                throw e;
            })))/* Unsubscribe when failed, and throw the error */)
        );
    }

    private async hbChannelInstall(device: Device, url: string, sha256sum?: string, progress?: InstallProgressHandler) {
        const luna = await this.luna.subscribe(device, 'luna://org.webosbrew.hbchannel.service/install', {
            ipkUrl: url,
            ipkHash: sha256sum,
            subscribe: true,
        });
        await lastValueFrom(luna.asObservable().pipe(
            map((v: LunaResponse): boolean => {
                if (v.returnValue === false) {
                    // If returnValue is false, then it must be a failure.
                    throw new LunaResponseError(v);
                } else if (v['finished']) {
                    return true;
                } else if (v.subscribed === false && v.returnValue) {
                    // We didn't get any positive result, but there was no error either. Treat it as success.
                    return true;
                }
                progress?.(v['progress'], v['statusText']);
                console.debug('install output', v);
                return false;
            }),
            filter(v => v)/* Only pick finish event */,
            mergeMap(() => luna.unsubscribe()) /* Unsubscribe when done */,
            catchError((e) => fromPromise(luna.unsubscribe().then(() => {
                const match = e instanceof LunaResponseError && e.details?.match(/(-?\d+): +(\w+)/);
                if (!match) {
                    throw e;
                }
                if (match[2] === 'FAILED_IPKG_INSTALL') {
                    if (match[1] === '-5') {
                        throw InstallError.insufficientSpace(e.details);
                    }
                }
                throw e;
            })))/* Unsubscribe when failed, and throw the error */)
        );
    }

}

function mapAppinstalldResponse(v: LunaResponse, expectResult: string | RegExp): boolean {
    const resultValue: string = _.get(v, ['details', 'state']) || '';
    if (resultValue.match(/FAILED/i)) {
        let details = v['details'];
        if (details && details.reason) {
            if (details.reason === 'FAILED_IPKG_INSTALL') {
                if (details.errorCode === -5) {
                    throw InstallError.insufficientSpace(details.reason);
                }
            }
            throw new Error(`${details.errorCode}: ${details.reason}`);
        }
        throw new Error(resultValue);
    } else if (resultValue.match(/^SUCCESS/i) || resultValue.match(expectResult)) {
        return true;
    }
    console.debug('appinstalld output', v);
    return false;
}

export interface InstallProgressHandler {
    (progress?: number, statusText?: string): void;
}

export class InstallError extends Error {
    constructor(message: string, public details: string) {
        super(message);
    }

    static insufficientSpace(details: string): InstallError {
        return new InstallError('Can\'t install because of insufficient space', details);
    }
}
