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

function matchesPlatform(platforms, platform) {
  return !platforms || !platforms.length || platforms.includes(platform);
}

async function generateIcons(platforms) {
  // Generate desktop icons
  if (matchesPlatform(platforms, 'desktop')) {
    await cli.run(['icon', '-o', tmpDesktopIcons, 'resources/icon/desktop.svg'], null);
  }
  if (matchesPlatform(platforms, 'android') || matchesPlatform(platforms, 'ios')) {
    await cli.run(['icon', '-o', tmpMobileIcons, '--ios-color', '#03A9F4', 'resources/icon/mobile.png'], null);
  }
}

async function copyIcons(platforms) {
  function iconPathSegs(source, base) {
    return source.substring(source.lastIndexOf(base) + base.length + 1).split(path.sep);
  }

  // Copy desktop icons
  if (matchesPlatform(platforms, 'desktop')) {
    await fs.cp(tmpDesktopIcons, 'src-tauri/icons', {
      recursive: true,
      filter(source, _destination) {
        const segs = iconPathSegs(source, tmpDesktopIcons);
        return segs[0] !== 'android' && segs[0] !== 'ios';
      }
    });
  }

  // Copy iOS icons
  if (matchesPlatform(platforms, 'ios')) {
    await fs.cp(tmpMobileIcons, 'src-tauri/icons', {
      recursive: true,
      filter(source, _destination) {
        const segs = iconPathSegs(source, tmpMobileIcons);
        return !segs[0] || segs[0] === 'ios';
      }
    });
  }

  // Clean Android icons
  if (matchesPlatform(platforms, 'android')) {
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
}

/**
 * @param {string} platforms
 */
async function run(...platforms) {
  console.log('Generating icons for platforms:', platforms?.join(', ') || 'all');
  try {
    await generateIcons(platforms);
    await copyIcons(platforms);
  } finally {
    rmSync(tmpDesktopIcons, {recursive: true});
    rmSync(tmpMobileIcons, {recursive: true});
  }
}

if (require.main === module) {
  run(...process.argv.slice(2)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  module.exports = {run};
}
