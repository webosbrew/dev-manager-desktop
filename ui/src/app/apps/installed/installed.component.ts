import {Component, Host} from '@angular/core';
import {AppsComponent} from '../apps.component';

@Component({
  selector: 'app-installed',
  templateUrl: './installed.component.html',
  styleUrls: ['./installed.component.scss']
})
export class InstalledComponent {

  constructor(@Host() public parent: AppsComponent) {
  }

}
