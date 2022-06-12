import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  Inject,
  Injector,
  StaticProvider,
  Type,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import {NgbActiveModal, NgbModal, NgbModalRef} from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-message-dialog',
  templateUrl: './message-dialog.component.html',
  styleUrls: ['./message-dialog.component.scss']
})
export class MessageDialogComponent implements AfterViewInit, MessageDialogConfig {
  title: string = '';
  message: string | Type<any> = '';
  positive: string = '';
  negative?: string;
  alternative?: string;
  positiveStyle?: ButtonStyle = 'primary';
  messageExtras?: Record<string, any>;

  @ViewChild('messageComponent', {read: ViewContainerRef})
  messageComponent?: ViewContainerRef;

  constructor(
    public modal: NgbActiveModal,
    private changeDetector: ChangeDetectorRef,
    @Inject('config') config: MessageDialogConfig
  ) {
    Object.assign(this, config);
  }

  ngAfterViewInit(): void {
    if (typeof this.message === 'function') {
      this.messageComponent?.clear();
      let providers: StaticProvider[] = [];
      if (this.messageExtras) {
        providers = Object.getOwnPropertyNames(this.messageExtras).map(name => ({
          provide: name,
          useValue: this.messageExtras && this.messageExtras[name]
        }));
      }
      this.messageComponent?.createComponent(this.message, {injector: Injector.create({providers})});
      this.changeDetector.detectChanges();
    }
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
      injector: Injector.create({
        providers: [{provide: 'config', useValue: config}]
      })
    });
  }

}

type ButtonStyle = 'danger' | 'primary';

export interface MessageDialogConfig {
  title?: string;
  message: string | Type<any>;
  positive: string | null;
  negative?: string | null;
  alternative?: string | null;
  positiveStyle?: ButtonStyle;
  messageExtras?: { [keys: string]: any };
}
