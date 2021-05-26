import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppsComponent } from './app/home/apps/apps.component';
import { FilesComponent } from './app/home/files/files.component';
import { TerminalComponent } from './app/home/terminal/terminal.component';
import { DeviceListComponent } from './device-list/device-list.component';
import { DeviceSetupComponent } from './device-setup/device-setup.component';
import { InfoComponent } from './device-setup/info/info.component';
import { PageNotFoundComponent } from './shared/components/page-not-found/page-not-found.component';


const routes: Routes = [
  {
    path: '',
    redirectTo: 'devices',
    pathMatch: 'full'
  },
  {
    path: 'devices', component: DeviceListComponent,
    children: [
      { path: 'apps', component: AppsComponent },
      { path: 'files', component: FilesComponent },
      { path: 'terminal', component: TerminalComponent },
      { path: '', redirectTo: 'apps', pathMatch: 'full' },
    ]
  },
  {
    path: 'devices/setup', component: DeviceSetupComponent,
    children: [
      { path: 'info', component: InfoComponent },
      { path: '', redirectTo: 'info', pathMatch: 'full' },
    ]
  },
  {
    path: '**',
    component: PageNotFoundComponent
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' }),
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
