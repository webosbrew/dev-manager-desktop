import {enableProdMode} from '@angular/core';
import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';

import {AppModule} from './app/app.module';
import {AppConfig} from './environments/environment';


if (AppConfig.production) {
  enableProdMode();
}

platformBrowserDynamic()
  .bootstrapModule(AppModule, {
    preserveWhitespaces: false
  })
  .catch(err => console.error(err));

const darkTheme = window.matchMedia('(prefers-color-scheme: dark)');

document.documentElement.setAttribute('data-bs-theme', darkTheme.matches ? 'dark' : 'light');
darkTheme.addEventListener('change', (media) => {
  document.documentElement.setAttribute('data-bs-theme', media.matches ? 'dark' : 'light');
});
