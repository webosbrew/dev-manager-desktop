import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppsComponent } from './home/apps/apps.component';
import { FilesComponent } from './home/files/files.component';
import { TerminalComponent } from './home/terminal/terminal.component';
import { HomeComponent } from './home/home.component';
import { DeviceSetupComponent } from './device-setup/device-setup.component';
import { InfoComponent } from './device-setup/info/info.component';
import { PageNotFoundComponent } from './shared/components/page-not-found/page-not-found.component';
import { PrepareAccountComponent } from './device-setup/prepare-account/prepare-account.component';
import { EnableDevmodeComponent } from './device-setup/enable-devmode/enable-devmode.component';
import { InstallDevmodeComponent } from './device-setup/install-devmode/install-devmode.component';
import { EnableKeyservComponent } from './device-setup/enable-keyserv/enable-keyserv.component';
import { AutoLookupComponent } from './device-setup/auto-lookup/auto-lookup.component';


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
    path: 'setup', component: DeviceSetupComponent,
    children: [
      { path: 'prepare-account', component: PrepareAccountComponent },
      { path: 'install-devmode', component: InstallDevmodeComponent },
      { path: 'enable-devmode', component: EnableDevmodeComponent },
      { path: 'enable-keyserv', component: EnableKeyservComponent },
      { path: 'auto-lookup', component: AutoLookupComponent },
      { path: 'info', component: InfoComponent },
      { path: '', redirectTo: 'prepare-account', pathMatch: 'full' },
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
