import { AfterViewInit, ChangeDetectorRef, Component, ComponentFactoryResolver, Inject, Injector, OnInit, ReflectiveInjector, Type, ViewChild, ViewContainerRef } from '@angular/core';
import { NgbModal, NgbModalRef, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
@Component({
  selector: 'app-message-dialog',
  templateUrl: './message-dialog.component.html',
  styleUrls: ['./message-dialog.component.scss']
})
export class MessageDialogComponent implements OnInit, AfterViewInit, MessageDialogConfig {
  title: string;
  message: string | Type<any>;
  positive: string;
  negative?: string;
  positiveStyle?: ButtonStyle = 'primary';
  messageExtras?: { [keys: string]: any };

  @ViewChild('messageComponent', { read: ViewContainerRef })
  messageComponent: ViewContainerRef;

  constructor(
    public modal: NgbActiveModal,
    private componentFactoryResolver: ComponentFactoryResolver,
    private changeDetector: ChangeDetectorRef,
    @Inject('config') config: MessageDialogConfig
  ) {
    Object.assign(this, config);
  }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    if (this.message instanceof Type) {
      const componentFactory = this.componentFactoryResolver.resolveComponentFactory(this.message);
      this.messageComponent.clear();
      const component = this.messageComponent.createComponent(componentFactory);
      if (this.messageExtras) {
        Object.assign(component.instance, this.messageExtras);
      }
      this.changeDetector.detectChanges();
    }
  }

  get messageType(): 'string' | 'component' {
    if (typeof this.message == 'string') {
      return 'string';
    } else if (this.message instanceof Type) {
      return 'component';
    } else {
      return null;
    }
  }

  static open(service: NgbModal, config: MessageDialogConfig): NgbModalRef {
    return service.open(MessageDialogComponent, {
      centered: true,
      injector: Injector.create({
        providers: [{ provide: 'config', useValue: config }]
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
  positiveStyle?: ButtonStyle;
  messageExtras?: { [keys: string]: any };
}
