"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageInfo = exports.AppManagerService = void 0;
var core_1 = require("@angular/core");
var rxjs_1 = require("rxjs");
var ares_utils_1 = require("../../shared/util/ares-utils");
var electron_service_1 = require("./electron.service");
var remote_1 = require("@electron/remote");
var AppManagerService = /** @class */ (function () {
    function AppManagerService(electron) {
        this.electron = electron;
        this.installLib = electron.installLib;
        this.launchLib = electron.launchLib;
        this.util = electron.util;
        this.packagesSubjects = new Map();
    }
    AppManagerService.prototype.packages$ = function (device) {
        return this.obtainSubject(device).asObservable();
    };
    AppManagerService.prototype.load = function (device) {
        var subject = this.obtainSubject(device);
        this.list(device)
            .then(function (pkgs) { return subject.next(pkgs); })
            .catch(function (error) { return subject.error(error); });
    };
    AppManagerService.prototype.list = function (device) {
        return __awaiter(this, void 0, void 0, function () {
            var list, options;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        list = this.util.promisify(this.installLib.list);
                        options = { device: device };
                        return [4 /*yield*/, list(options)
                                .then(function (result) { return result.map(function (item) { return new PackageInfo(item); }); })
                                .finally(function () {
                                var _a;
                                (_a = options.session) === null || _a === void 0 ? void 0 : _a.end();
                                (0, ares_utils_1.cleanupSession)();
                            })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AppManagerService.prototype.info = function (device, id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.list(device).then(function (pkgs) { return pkgs.find(function (pkg) { return pkg.id == id; }); })];
            });
        });
    };
    AppManagerService.prototype.install = function (device, path) {
        return __awaiter(this, void 0, void 0, function () {
            var install, options;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        install = this.util.promisify(this.installLib.install);
                        options = { device: device, appId: 'com.ares.defaultDame', opkg: false };
                        return [4 /*yield*/, install(options, path)
                                .then(function () { return _this.load(device); })
                                .finally(function () {
                                var _a;
                                (_a = options.session) === null || _a === void 0 ? void 0 : _a.end();
                                (0, ares_utils_1.cleanupSession)();
                            })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AppManagerService.prototype.installUrl = function (device, url) {
        return __awaiter(this, void 0, void 0, function () {
            var path, tempPath, ipkPath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        path = this.electron.path;
                        tempPath = remote_1.app.getPath('temp');
                        ipkPath = path.join(tempPath, "devmgr_temp_" + Date.now() + ".ipk");
                        return [4 /*yield*/, this.electron.downloadFile(url, ipkPath)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.install(device, ipkPath)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AppManagerService.prototype.remove = function (device, pkgName) {
        return __awaiter(this, void 0, void 0, function () {
            var remove, options;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        remove = this.util.promisify(this.installLib.remove);
                        options = { device: device, opkg: false };
                        return [4 /*yield*/, remove(options, pkgName)
                                .then(function () { return _this.load(device); })
                                .finally(function () {
                                var _a;
                                (_a = options.session) === null || _a === void 0 ? void 0 : _a.end();
                                (0, ares_utils_1.cleanupSession)();
                            })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AppManagerService.prototype.launch = function (device, appId) {
        return __awaiter(this, void 0, void 0, function () {
            var launch, options;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        launch = this.util.promisify(this.launchLib.launch);
                        options = { device: device, inspect: false };
                        return [4 /*yield*/, launch(options, appId, {})
                                .finally(function () {
                                var _a;
                                (_a = options.session) === null || _a === void 0 ? void 0 : _a.end();
                                (0, ares_utils_1.cleanupSession)();
                            })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AppManagerService.prototype.close = function (device, appId) {
        return __awaiter(this, void 0, void 0, function () {
            var close, options;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        close = this.util.promisify(this.launchLib.close);
                        options = { device: device, inspect: false };
                        return [4 /*yield*/, close(options, appId, {})
                                .finally(function () {
                                var _a;
                                (_a = options.session) === null || _a === void 0 ? void 0 : _a.end();
                                (0, ares_utils_1.cleanupSession)();
                            })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AppManagerService.prototype.obtainSubject = function (device) {
        var subject = this.packagesSubjects.get(device);
        if (!subject) {
            subject = new rxjs_1.ReplaySubject(1);
            this.packagesSubjects.set(device, subject);
        }
        return subject;
    };
    AppManagerService = __decorate([
        (0, core_1.Injectable)({
            providedIn: 'root'
        }),
        __metadata("design:paramtypes", [electron_service_1.ElectronService])
    ], AppManagerService);
    return AppManagerService;
}());
exports.AppManagerService = AppManagerService;
var PackageInfo = /** @class */ (function () {
    function PackageInfo(info) {
        Object.assign(this, info);
    }
    Object.defineProperty(PackageInfo.prototype, "iconPath", {
        get: function () {
            return this.folderPath + "/" + this.icon;
        },
        enumerable: false,
        configurable: true
    });
    return PackageInfo;
}());
exports.PackageInfo = PackageInfo;
//# sourceMappingURL=app-manager.service.js.map