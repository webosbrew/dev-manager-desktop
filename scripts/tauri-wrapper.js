#!/usr/bin/env node
'use strict';

if (process.platform === 'win32' && process.argv[2] === 'android') {
  process.env['PERL'] = 'C:/msys64/usr/bin/perl.exe';

  const ndkPath = process.env['NDK_HOME'] + '\\toolchains\\llvm\\prebuilt\\windows-x86_64\\bin';
  process.env['Path'] = process.env['Path'] + ';C:/msys64/usr/bin;' + ndkPath;
}

require('@tauri-apps/cli/tauri');
