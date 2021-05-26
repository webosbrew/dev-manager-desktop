import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppsComponent } from './home/apps/apps.component';
import { FilesComponent } from './home/files/files.component';
import { HomeComponent } from './home/home.component';
import { TerminalComponent } from './home/terminal/terminal.component';


const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'home', component: HomeComponent,
    children: [
      { path: 'apps', component: AppsComponent },
      { path: 'files', component: FilesComponent },
      { path: 'terminal', component: TerminalComponent },
      { path: '', redirectTo: 'apps', pathMatch: 'full' },
    ]
  },
  {
    path: '**',
    redirectTo: 'home'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' }),
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
