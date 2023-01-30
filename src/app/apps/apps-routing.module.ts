import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {AppsComponent} from "./apps.component";

const routes: Routes = [
  {path: '', component: AppsComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AppsRoutingModule {
}
