import {Component, Inject, Injector, StaticProvider, Type} from '@angular/core';
import {NgbActiveModal, NgbModal, NgbModalRef} from '@ng-bootstrap/ng-bootstrap';
import {isFunction} from "lodash-es";

@Component({
    selector: 'app-message-dialog',
    templateUrl: './message-dialog.component.html',
    styleUrls: ['./message-dialog.component.scss']
})
export class MessageDialogComponent implements MessageDialogConfig {
    title: string = '';
    message: string | Type<any> = '';
    positive: string = '';
    positiveDisabled?: boolean;
    positiveAction?: () => any;
    negative?: string;
    negativeDisabled?: boolean;
    negativeAction?: () => any;
    alternative?: string;
    alternativeDisabled?: boolean;
    alternativeAction?: () => any;
    autofocus?: 'positive' | 'negative' | 'alternative';
    positiveStyle?: ButtonStyle = 'primary';
    messageExtras?: Record<string, any>;
    messageInjector?: Injector;
    error?: Error;

    constructor(
        public modal: NgbActiveModal,
        @Inject('config') config: MessageDialogConfig
    ) {
        Object.assign(this, config);
        let providers: StaticProvider[] = [];
        if (this.messageExtras) {
            providers = Object.getOwnPropertyNames(this.messageExtras).map(name => ({
                provide: name,
                useValue: this.messageExtras && this.messageExtras[name]
            }));
        }
        this.messageInjector = Injector.create({
            providers: [
                {provide: MessageDialogComponent, useValue: this},
                ...providers
            ]
        });
    }

    get messageType(): 'string' | 'component' | null {
        if (typeof this.message === 'string') {
            return 'string';
        } else if (typeof this.message === 'function') {
            return 'component';
        } else {
            return null;
        }
    }

    static open(service: NgbModal, config: MessageDialogConfig): NgbModalRef {
        return service.open(MessageDialogComponent, {
            centered: true,
            size: config.size || 'lg',
            scrollable: true,
            beforeDismiss: () => {
                if (isFunction(config.cancellable)) {
                    return config.cancellable();
                }
                return config.cancellable !== false;
            },
            injector: Injector.create({
                providers: [{provide: 'config', useValue: config}]
            })
        });
    }

    positiveClicked() {
        this.modal.close(this.positiveAction?.() ?? true);
    }

    negativeClicked() {
        this.modal.close(this.negativeAction?.() ?? false);
    }

    alternativeClicked() {
        this.modal.close(this.alternativeAction?.() ?? null);
    }

}

type ButtonStyle = 'danger' | 'primary';

export interface MessageDialogConfig {
    title?: string;
    message: string | Type<any>;
    positive: string;
    negative?: string;
    alternative?: string;
    cancellable?: boolean | (() => boolean | Promise<boolean>);
    autofocus?: 'positive' | 'negative' | 'alternative';
    positiveStyle?: ButtonStyle;
    error?: Error;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    messageExtras?: { [keys: string]: any };
}
