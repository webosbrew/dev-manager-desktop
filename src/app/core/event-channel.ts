import {emit, Event, listen, once, UnlistenFn} from "@tauri-apps/api/event";

export abstract class EventChannel<RxPayload, ClosePayload> {
    private promise?: Promise<UnlistenFn[]>;
    private isClosed: boolean = false;

    protected constructor(protected token: string) {
        this.promise = Promise.all([
            listen<RxPayload>(`${token}:rx`, (e: Event<RxPayload>) => {
                console.debug('event-channel::rx', this.token, e.payload);
                if (this.isClosed) {
                    return;
                }
                this.onReceive(e.payload);
            }),
            once<ClosePayload>(`${token}:closed`, (e: Event<ClosePayload>) => {
                console.debug('event-channel::closed', this.token, e.payload);
                if (this.isClosed) {
                    return;
                }
                this.isClosed = true;
                this.onClose(e.payload);
            }),
        ]);
    }

    public get closed(): boolean {
        return this.isClosed;
    }

    public async unlisten(): Promise<void> {
        if (!this.promise) {
            return;
        }
        console.log('EventChannel', 'unlisten all');
        await this.promise?.then(list => list.forEach(f => f?.()));
        this.promise = undefined;
    }

    public async send<P>(payload?: P): Promise<void> {
        console.debug('event-channel::tx', this.token, payload);
        return emit(`${this.token}:tx`, payload);
    }

    public async close<P>(payload?: P): Promise<void> {
        console.debug('event-channel::close', this.token, payload);
        return emit(`${this.token}:close`, payload);
    }

    abstract onReceive(payload: RxPayload): void;

    abstract onClose(payload: ClosePayload): void;

}
