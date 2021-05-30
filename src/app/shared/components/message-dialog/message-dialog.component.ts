import { AfterViewInit, Component, ComponentFactoryResolver, OnInit, Type, ViewChild, ViewContainerRef } from '@angular/core';
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

  @ViewChild('messageComponent', { read: ViewContainerRef })
  messageComponent: ViewContainerRef;

  constructor(
    public modal: NgbActiveModal,
    private componentFactoryResolver: ComponentFactoryResolver
  ) { }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    if (this.message instanceof Type) {
      const componentFactory = this.componentFactoryResolver.resolveComponentFactory(this.message);
      this.messageComponent.clear();
      this.messageComponent.createComponent(componentFactory);
    }
  }

  get messageType(): 'string' | 'component' {
    if (this.message instanceof String) {
      return 'string';
    } else if (this.message instanceof Type) {
      return 'component';
    } else {
      return null;
    }
  }

  static open(service: NgbModal, config: MessageDialogConfig): NgbModalRef {
    const ref = service.open(MessageDialogComponent, {
      centered: true
    });
    Object.assign(ref.componentInstance, config);
    return ref;
  }

}

type ButtonStyle = 'danger' | 'primary';

interface MessageDialogConfig {
  title?: string;
  message: string | Type<any>;
  positive: string | null;
  negative?: string | null;
  positiveStyle?: ButtonStyle;
}
