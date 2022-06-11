import {Component, Host, OnInit} from '@angular/core';
import {AppsRepoService, RepositoryItem} from '../../core/services';
import {AppsComponent} from '../apps.component';

@Component({
  selector: 'app-installed',
  templateUrl: './installed.component.html',
  styleUrls: ['./installed.component.scss']
})
export class InstalledComponent implements OnInit {

  constructor(
    @Host() public parent: AppsComponent,
    private appsRepo: AppsRepoService
  ) {
  }

  ngOnInit(): void {
  }

}
