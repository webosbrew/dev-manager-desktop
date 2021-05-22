import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DeviceListComponent } from './device-list/device-list.component';
import { DeviceSetupComponent } from './device-setup/device-setup.component';
import { PageNotFoundComponent } from './shared/components';


const routes: Routes = [
  {
    path: '',
    redirectTo: 'devices',
    pathMatch: 'full'
  },
  { path: 'devices', component: DeviceListComponent },
  { path: 'devices/setup', component: DeviceSetupComponent },
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
