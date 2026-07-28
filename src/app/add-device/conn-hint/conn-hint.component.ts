import {Component, ChangeDetectionStrategy} from '@angular/core';

@Component({
    selector: 'app-conn-hint',
    templateUrl: './conn-hint.component.html',
    styleUrls: ['./conn-hint.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ConnHintComponent {

  constructor() {
  }

}
