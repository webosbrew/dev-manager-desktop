// Karma configuration, used only by the `test-integration` target: those specs
// run inside a real Tauri window against the real Rust backend, which needs the
// custom launcher below. The mocked headless suite (`npm test`) runs on vitest
// via @angular/build:unit-test and does not read this file.
// https://karma-runner.github.io/1.0/config/configuration-file.html

/** @param config {import('karma').Config} */
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('./scripts/karma-tauri-launcher'),
    ],
    client: {
      jasmine: {
        // you can add configuration options for Jasmine here
        // the possible options are listed at https://jasmine.github.io/api/edge/Configuration.html
        // for example, you can disable the random execution with `random: false`
        // or set a specific seed with `seed: 4321`
      },
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    captureTimeout: 3600 * 1000,
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/ui'),
      subdir: '.',
      reporters: [
        {type: 'html'},
        {type: 'text-summary'}
      ]
    },
    reporters: ['progress', 'kjhtml'],
    retryLimit: 0,
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    singleRun: false,
    restartOnFileChange: true
  });
};
