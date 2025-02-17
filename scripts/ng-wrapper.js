#!/usr/bin/env node
'use strict';


/**
 * @param arg {String}
 * @return {boolean}
 */
function isConfigurationArgument(arg) {
  return arg.startsWith('--configuration=');
}

switch (process.argv[2]) {
  case 'serve':
    if (process.env.TAURI_DEV_HOST) {
      process.argv.push(`--host=${process.env.TAURI_DEV_HOST}`, '--disable-host-check');
    }
  // noinspection FallThroughInSwitchStatementJS
  case 'build':
    if (process.env.TAURI_DEBUG === "true" && !process.argv.slice(3).find(isConfigurationArgument)) {
      process.argv.push('--configuration=development');
    }
    break;
}

require('@angular/cli/bin/ng');
