import {Component, Input, OnDestroy} from '@angular/core';
import {Device} from "../../types";
import {finalize, from, Observable, Subscription} from "rxjs";
import {ExecutionError, RemoteCommandService} from "../../core/services/remote-command.service";
import {map} from "rxjs/operators";
import {trimEnd} from "lodash-es";
import {readTextFileLines} from '@tauri-apps/plugin-fs'
import {open as showOpenDialog} from '@tauri-apps/plugin-dialog'
import {TokenizedSearchParserResult} from "../../shared/directives";

export declare interface MonitorMessage {
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

export declare interface MonitorMessageItem extends MonitorMessage {
    information: string;
}

export declare interface CallEntry {
    name: string;
    sender: string;
    destination: string;
    information: string;
    messages: MonitorMessageItem[];
}

declare interface SearchQuery {
    text?: string[];
    sender?: string[];
    destination?: string[];
    exclude?: Omit<SearchQuery, 'exclude'>;
}

@Component({
    selector: 'app-ls-monitor',
    templateUrl: './ls-monitor.component.html',
    styleUrl: './ls-monitor.component.scss'
})
export class LsMonitorComponent implements OnDestroy {

    @Input()
    device: Device | null = null;

    messages?: Observable<MonitorMessage>;
    isCapture: boolean = false;
    isCapturing: boolean = false;
    rows: CallEntry[] = [];
    selectedRow?: CallEntry;
    private entriesMap: Record<string, CallEntry> = {};

    private unsubscribe?: Subscription;
    private searchQuery: SearchQuery = {};

    constructor(private cmd: RemoteCommandService) {
    }

    ngOnDestroy() {
        this.unsubscribe?.unsubscribe();
    }

    queryUpdated(query: TokenizedSearchParserResult) {
        this.searchQuery = query;
        console.log('ls-monitor search query', query);
        const messages = this.messages;
        if (!messages) {
            return;
        }
        this.reload(messages);
    }

    async beginCapture() {
        const device = this.device;
        if (!device) {
            return;
        }
        const proc = await this.cmd.popen(device, "ls-monitor -j", "utf-8");
        this.isCapture = true;
        this.isCapturing = true;
        this.messages = proc.pipe(
            map(line => JSON.parse(line.data) as MonitorMessage),
            finalize(() => {
                this.isCapturing = false;
                proc.write();
            })
        );
        this.reload(this.messages);
    }

    async openFromFile() {
        const selected = await showOpenDialog({filters: [{name: 'JSON', extensions: ['jsonl']}]})
            .catch(() => null);
        if (!selected) {
            return;
        }
        this.isCapture = false;
        this.messages = from(await readTextFileLines(selected.path)).pipe(
            map(line => JSON.parse(line) as MonitorMessage)
        );
        this.reload(this.messages);
    }

    private reload(messages: Observable<MonitorMessage>) {
        this.unsubscribe?.unsubscribe();
        this.rows = [];
        this.selectedRow = undefined;
        this.entriesMap = {};
        this.unsubscribe = messages.subscribe({
            next: message => {
                if (message.transport == 'TX') {
                    switch (message.type) {
                        case 'call': {
                            if (!LsMonitorComponent.messageMatches(message, this.searchQuery)) {
                                return;
                            }
                            const name = LsMonitorComponent.callName(message);
                            const item = {
                                name,
                                sender: message.sender,
                                destination: message.destination,
                                payload: message.payload,
                                information: LsMonitorComponent.messageInformation(message),
                                messages: [{...message, information: LsMonitorComponent.messageInformation(message)}],
                            };
                            this.rows.push(item);
                            this.entriesMap[LsMonitorComponent.messageKey(message)] = item;
                            break;
                        }
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

    private static callName(message: MonitorMessage): string {
        return `${message.destination}${trimEnd(message.methodCategory, '/')}/${message.method}`;
    }

    private static shortServiceName(service: string): string {
        return service.replace(/^com\.(webos|palm|lge)(\.service)?/, (_substring, ...args) => {
            return `c.${args[0][0]}${args[1] ? '.s' : ''}`
        });
    }

    private static messageInformation(message: MonitorMessage): string {
        return message.rawPayload || JSON.stringify(message.payload);
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

    private static messageMatches(message: MonitorMessage, query: SearchQuery): boolean {
        if (query.exclude) {
            if (query.exclude.sender?.includes(message.sender)) {
                return false;
            }
            if (query.exclude.destination?.includes(message.destination)) {
                return false;
            }
        }
        if (query.sender && !query.sender.includes(message.sender)) {
            return false;
        }
        if (query.destination && !query.destination.includes(message.destination)) {
            return false;
        }
        return true;
    }

}
