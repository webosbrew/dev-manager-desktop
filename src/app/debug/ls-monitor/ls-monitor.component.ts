import {Component, Input, OnDestroy} from '@angular/core';
import {Device} from "../../types";
import {from, identity, mergeMap, Observable, Subscription} from "rxjs";
import {ExecutionError, RemoteCommandService} from "../../core/services/remote-command.service";
import {map} from "rxjs/operators";
import {trimEnd, trimStart, truncate} from "lodash-es";

declare interface MonitorMessage {
    senderUniqueName: string;
    destinationUniqueName: string;
    type: 'call' | 'callCancel' | 'return' | 'signal' | 'error' | string;
    replyToken?: number;
    token?: number;
    transport: 'RX' | 'TX';
    sender: string;
    destination: string;
    methodCategory: string;
    method: string;
    payload?: Record<string, unknown>;
    rawPayload?: string;
}

declare interface MonitorMessageItem extends MonitorMessage {
    information: string;
}

declare interface CallEntry {
    name: string;
    sender: string;
    destination: string;
    information: string;
    messages: MonitorMessageItem[];
}

@Component({
    selector: 'app-ls-monitor',
    templateUrl: './ls-monitor.component.html',
    styleUrl: './ls-monitor.component.scss'
})
export class LsMonitorComponent implements OnDestroy {

    messages?: Observable<MonitorMessage>;
    rows: CallEntry[] = [];
    selectedRow?: CallEntry;
    private entriesMap: Record<string, CallEntry> = {};

    private deviceField: Device | null = null;
    private unsubscribe?: Subscription;

    constructor(private cmd: RemoteCommandService) {
    }

    get device(): Device | null {
        return this.deviceField;
    }

    @Input()
    set device(device: Device | null) {
        this.deviceField = device;
        this.messages = undefined;
        if (device) {
            this.reload(device);
        }
    }

    ngOnDestroy() {
        this.unsubscribe?.unsubscribe();
    }

    private reload(device: Device) {
        this.messages = from(this.createMonitor(device)).pipe(mergeMap(identity));
        this.unsubscribe = this.messages.subscribe({
            next: message => {
                if (message.transport == 'TX') {
                    switch (message.type) {
                        case 'call':
                            const name = LsMonitorComponent.callName(message);
                            const item = {
                                name,
                                sender: LsMonitorComponent.shortServiceName(message.sender),
                                destination: message.destination,
                                payload: message.payload,
                                information: LsMonitorComponent.messageInformation(message),
                                messages: [{...message, information: LsMonitorComponent.messageInformation(message)}],
                            };
                            this.rows.push(item);
                            this.entriesMap[LsMonitorComponent.messageKey(message)] = item;
                            break;
                        case 'return':
                        case 'callCancel':
                            const entry = this.entriesMap[LsMonitorComponent.messageKey(message)];
                            if (entry) {
                                entry.messages.push({
                                    ...message,
                                    information: LsMonitorComponent.messageInformation(message)
                                });
                            }
                            break;
                        default:
                            console.log('monitor', message.type, message.transport, message.sender, '=>', message.destination, message.methodCategory, message.method, message.payload, message);
                            break;
                    }
                }
            },
            error: error => {
                if (error instanceof ExecutionError) {
                    console.error('monitor err', error, error.details);
                } else {
                    console.error('monitor err', error);
                }
            },
        });
    }

    private async createMonitor(device: Device): Promise<Observable<MonitorMessage>> {
        return (await this.cmd.popen(device, "ls-monitor -j", "utf-8"))
            .pipe(map(line => JSON.parse(line.data) as MonitorMessage));
    }

    private static callName(message: MonitorMessage): string {
        return `${this.shortServiceName(message.destination)}${trimEnd(message.methodCategory, '/')}/${message.method}`;
    }

    private static shortServiceName(service: string): string {
        return service.replace(/^com\.(webos|palm|lge)(\.service)?/, (_substring, ...args) => {
            return `c.${args[0][0]}${args[1] ? '.s' : ''}`
        });
    }

    private static messageInformation(message: MonitorMessage): string {
        return truncate(message.rawPayload || JSON.stringify(message.payload), {length: 100});
    }

    private static messageKey(message: MonitorMessage): string {
        switch (message.type) {
            case 'return':
                return `${message.destinationUniqueName}:${message.senderUniqueName}:${message.replyToken}`;
            case 'callCancel':
                return `${message.senderUniqueName}:${message.destinationUniqueName}:${message.payload!['token']}`;
            default:
                return `${message.senderUniqueName}:${message.destinationUniqueName}:${message.token}`;
        }
    }
}
