import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {DebugComponent} from "./debug.component";
import {CrashesComponent} from "./crashes/crashes.component";

const routes: Routes = [{
  path: '',
  component: DebugComponent,
  children: [
    {
      path: '#crashes',
      component: CrashesComponent
    }
  ]
}];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DebugRoutingModule {
}
