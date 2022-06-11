import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {HomeComponent} from './home/home.component';
import {InfoComponent} from './info/info.component';


const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'home', component: HomeComponent,
    children: [
      {path: 'apps', loadChildren: () => import('./apps').then(m => m.AppsModule)},
      {path: 'files', loadChildren: () => import('./files').then(m => m.FilesModule)},
      {path: 'terminal', loadChildren: () => import('./terminal').then(m => m.TerminalModule)},
      {path: 'info', loadChildren: () => import('./info').then(m => m.InfoModule)},
      {path: '', redirectTo: 'apps', pathMatch: 'full'},
    ]
  },
  {
    path: '**',
    redirectTo: 'home'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {relativeLinkResolution: 'legacy', useHash: true}),
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
