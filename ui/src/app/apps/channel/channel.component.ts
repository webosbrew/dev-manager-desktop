import {Component, Host, Input, OnInit} from '@angular/core';
import {Observable} from 'rxjs';
import {AppsRepoService, RepositoryPage} from '../../core/services';
import {AppsComponent} from '../apps.component';
import {PackageInfo} from "../../../../../main/types";

@Component({
  selector: 'app-channel',
  templateUrl: './channel.component.html',
  styleUrls: ['./channel.component.scss']
})
export class ChannelComponent implements OnInit {

  page = 1;
  repoPage$?: Observable<RepositoryPage>;

  @Input()
  installed?: Record<string, PackageInfo>;

  constructor(
    @Host() public parent: AppsComponent,
    private appsRepo: AppsRepoService) {
  }

  ngOnInit(): void {
    this.loadPage(1);
  }

  loadPage(page: number): void {
    this.repoPage$ = this.appsRepo.allApps$(page);
  }
}
