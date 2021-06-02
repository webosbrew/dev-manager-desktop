import { Component, Host, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { AppsRepoService, RepositoryPage } from '../../../core/services';
import { AppsComponent } from '../apps.component';
@Component({
  selector: 'app-channel',
  templateUrl: './channel.component.html',
  styleUrls: ['./channel.component.scss']
})
export class ChannelComponent implements OnInit {

  page = 1;
  repoPage$: Observable<RepositoryPage>;

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
