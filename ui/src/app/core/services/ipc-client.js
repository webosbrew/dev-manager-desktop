"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcClient = void 0;
var electron_1 = require("electron");
var IpcClient = /** @class */ (function () {
    function IpcClient(category) {
        this.category = category;
    }
    IpcClient.prototype.call = function (method) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return electron_1.ipcRenderer.invoke(this.category + "/" + method, args);
    };
    IpcClient.prototype.on = function (method, handler) {
        electron_1.ipcRenderer.on(this.category + "/" + method, function (event, args) { return handler(args); });
    };
    return IpcClient;
}());
exports.IpcClient = IpcClient;
//# sourceMappingURL=ipc-client.js.map