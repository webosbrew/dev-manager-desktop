#!/usr/bin/env node
'use strict';

const https = require('https');
const fs = require('fs');
const child_process = require('child_process');
const path = require('path');
const cli = require('@tauri-apps/cli');

async function downloadFile(url, dest) {
  const fileHandle = fs.openSync(dest, 'w');
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download file: ${res.statusCode}`));
      }
      res.setEncoding('binary');
      res.on('data', (data) => {
        fs.appendFileSync(fileHandle, data, {encoding: 'binary'});
      });
      res.on('end', resolve);
      res.on('error', reject);
    });
  }).finally(() => fs.closeSync(fileHandle));
}

async function prepareOpenSSL() {
  await fs.promises.mkdir('tmp', {recursive: true});
  if (!await fs.promises.access('tmp/android_openssl-master').then(() => true).catch(() => false)) {
    await downloadFile('https://github.com/KDAB/android_openssl/archive/refs/heads/master.tar.gz', 'tmp/android_openssl-master.tar.gz');
    await new Promise((resolve, reject) => {
      child_process.exec('tar -xzf android_openssl-master.tar.gz', {cwd: 'tmp'}, (err) => {
        if (err) reject(err);
        else resolve();
      });
    }).catch(async (err) => {
      await fs.rm('tmp/android_openssl-master', {recursive: true, force: true});
      throw err;
    });
  }
  const opensslDir = path.resolve('tmp', 'android_openssl-master', 'ssl_1.1');
  process.env['OPENSSL_NO_VENDOR'] = '1';
  process.env['OPENSSL_INCLUDE_DIR'] = path.join(opensslDir, 'include');
  process.env['AARCH64_LINUX_ANDROID_OPENSSL_LIB_DIR'] = path.join(opensslDir, 'arm64-v8a');
  process.env['ARMV7_LINUX_ANDROIDEABI_OPENSSL_LIB_DIR'] = path.join(opensslDir, 'armeabi-v7a');
  process.env['I686_LINUX_ANDROID_OPENSSL_LIB_DIR'] = path.join(opensslDir, 'x86');
  process.env['X86_64_LINUX_ANDROID_OPENSSL_LIB_DIR'] = path.join(opensslDir, 'x86_64');
}

async function copyOpenSSLLibs() {
  const opensslDir = path.resolve('tmp', 'android_openssl-master', 'ssl_1.1');
  await fs.promises.mkdir('src-tauri/gen/android/app/src/main/jniLibs', {recursive: true});
  await fs.promises.cp(path.join(opensslDir), 'src-tauri/gen/android/app/src/main/jniLibs', {
    recursive: true,
    async filter(source, destination) {
      if ((await fs.promises.lstat(source)).isSymbolicLink()) {
        return false;
      }
      return !source.endsWith('include') && !source.endsWith('.a') && !source.endsWith('.h');
    }
  });
}

async function run() {
  if (process.platform === 'win32' && process.argv[2] === 'android') {
    await prepareOpenSSL();
  }
  await cli.run(process.argv.slice(2), null);

}

run().then(async () => {
  if (process.argv[2] === 'android' && process.argv[3] === 'init') {
    const icoGen = require('./icon-generator');
    await icoGen.run('android');
    if (process.platform === 'win32') {
      await copyOpenSSLLibs();
    }
  }
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
