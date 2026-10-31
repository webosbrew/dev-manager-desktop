#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const patterns = [
  'target/**/bundle/deb/*.deb',
  'target/**/bundle/rpm/*.rpm',
  'target/**/bundle/appimage/*.AppImage',
  'target/**/bundle/appimage/*.AppImage.zsync',
  'target/**/bundle/msi/*.msi',
  'target/**/bundle/dmg/*.dmg',
];

const paths = [...new Set(patterns.flatMap(pattern => fs.globSync(pattern).map(path => path.replaceAll('\\', '/'))))].sort();
const output = process.env.GITHUB_OUTPUT;
if (!output) {
  throw new Error('GITHUB_OUTPUT is required');
}

fs.appendFileSync(output, `paths<<ARTIFACT_PATHS\n${paths.join('\n')}\nARTIFACT_PATHS\n`);
console.log(`Found ${paths.length} release artifact(s)`);
