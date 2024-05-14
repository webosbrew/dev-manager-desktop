#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const {mkdirSync, mkdtempSync, rmSync} = require('fs');
const cli = require('@tauri-apps/cli');

mkdirSync('tmp', {recursive: true});

// Create a temporary directory to store desktop icons
const tmpDesktopIcons = mkdtempSync(path.join('tmp', 'icons-desktop-'));
const tmpMobileIcons = mkdtempSync(path.join('tmp', 'icons-mobile-'));

async function generateIcons() {
  // Generate desktop icons
  await cli.run(['icon', '-o', tmpDesktopIcons, 'resources/icon/desktop.svg'], null);
  await cli.run(['icon', '-o', tmpMobileIcons, '--ios-color', '#03A9F4', 'resources/icon/mobile.png'], null);
}

async function copyIcons() {
  function iconPathSegs(source, base) {
    return source.substring(source.lastIndexOf(base) + base.length + 1).split(path.sep);
  }

  // Copy desktop icons
  await fs.cp(tmpDesktopIcons, 'src-tauri/icons', {
    recursive: true,
    filter(source, _destination) {
      const segs = iconPathSegs(source, tmpDesktopIcons);
      return segs[0] !== 'android' && segs[0] !== 'ios';
    }
  });

  // Copy iOS icons
  await fs.cp(tmpMobileIcons, 'src-tauri/icons', {
    recursive: true,
    filter(source, _destination) {
      const segs = iconPathSegs(source, tmpMobileIcons);
      return !segs[0] || segs[0] === 'ios';
    }
  });

  // Clean Android icons
  const androidResDir = 'src-tauri/gen/android/app/src/main/res';
  for (const file of await fs.readdir(androidResDir, {recursive: true})) {
    const segs = file.split(path.sep);
    if (segs.length === 2 && (segs[0].startsWith('mipmap') || segs[0].startsWith('drawable')) && segs[1].startsWith('ic_launcher')) {
      await fs.rm(path.join(androidResDir, file));
    }
  }

  // Copy ic_launcher, ic_launcher_background
  await fs.cp(path.join('resources/icon/android/main'), path.join(androidResDir), {recursive: true});

  // Copy ic_launcher_foreground
  await fs.cp(path.join(tmpMobileIcons, 'android'), androidResDir, {
    recursive: true,
    filter(source, _destination) {
      const segs = iconPathSegs(source, tmpMobileIcons);
      if (segs[0] && segs[0] !== 'android') {
        return false;
      }
      return !segs[2] || segs[2] === 'ic_launcher_foreground.png';
    }
  });
}

generateIcons().then(() => copyIcons()).finally(() => {
  rmSync(tmpDesktopIcons, {recursive: true});
  rmSync(tmpMobileIcons, {recursive: true});
});
