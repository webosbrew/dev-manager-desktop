const TauriLauncher = /** @class */ (function () {

  function TauriLauncher(baseBrowserDecorator, name, logger) {
    baseBrowserDecorator(this);
    let tauriCommand = ['dev'];
    if (name === 'TauriAndroid') {
      tauriCommand = ['android', 'dev'];
    }
    this._getOptions = function (url) {
      const tauriConfOverride = {build: {beforeDevCommand: '', devUrl: url}};
      return ['scripts/tauri-wrapper.js', ...tauriCommand, '-c', JSON.stringify(tauriConfOverride), '-f', 'karma'];
    };
    let log = logger.create('tauri');
    this._onStdout = function (data) {
      log.info(data.toString().trimEnd());
    };
    this._onStderr = function (data) {
      log.info(data.toString().trimEnd());
    };
  }

  TauriLauncher.prototype = {
    name: 'Tauri',
    DEFAULT_CMD: new Proxy({}, {
      get: () => process.execPath,
    }),
  };

  TauriLauncher.$inject = ['baseBrowserDecorator', 'name', 'logger'];

  return TauriLauncher;
}());

module.exports = {
  'launcher:TauriDesktop': ['type', TauriLauncher],
  'launcher:TauriAndroid': ['type', TauriLauncher],
};
