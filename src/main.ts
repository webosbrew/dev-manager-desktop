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

function isDarkTheme(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

document.documentElement.setAttribute('data-bs-theme', isDarkTheme() ? 'dark' : 'light');
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  document.documentElement.setAttribute('data-bs-theme', isDarkTheme() ? 'dark' : 'light');
});
