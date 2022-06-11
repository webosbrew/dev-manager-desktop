"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.CrashReport = exports.DeviceManagerService = void 0;
var http_1 = require("@angular/common/http");
var core_1 = require("@angular/core");
var rxjs_1 = require("rxjs");
var electron_service_1 = require("./electron.service");
var ipc_client_1 = require("./ipc-client");
var DeviceManagerService = /** @class */ (function (_super) {
    __extends(DeviceManagerService, _super);
    function DeviceManagerService(electron, http) {
        var _this = _super.call(this, 'device-manager') || this;
        _this.electron = electron;
        _this.http = http;
        _this.devicesSubject = new rxjs_1.BehaviorSubject([]);
        _this.selectedSubject = new rxjs_1.BehaviorSubject(null);
        _this.on('devicesUpdated', function (devices) { return _this.onDevicesUpdated(devices); });
        _this.load();
        return _this;
    }
    Object.defineProperty(DeviceManagerService.prototype, "devices$", {
        get: function () {
            return this.devicesSubject.asObservable();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(DeviceManagerService.prototype, "selected$", {
        get: function () {
            return this.selectedSubject.asObservable();
        },
        enumerable: false,
        configurable: true
    });
    DeviceManagerService.prototype.load = function () {
        var _this = this;
        this.list().then(function (devices) { return _this.onDevicesUpdated(devices); });
    };
    DeviceManagerService.prototype.list = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.call('list')];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    DeviceManagerService.prototype.addDevice = function (spec) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.call('addDevice', spec)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    DeviceManagerService.prototype.modifyDevice = function (name, spec) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.call('modifyDevice', name, spec)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    DeviceManagerService.prototype.setDefault = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.call('setDefault', name)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    DeviceManagerService.prototype.removeDevice = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.call('removeDevice', name)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    DeviceManagerService.prototype.getPrivKey = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.call('getPrivKey', address)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    DeviceManagerService.prototype.checkConnectivity = function (address, port) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.call('checkConnectivity', address, port)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    DeviceManagerService.prototype.osInfo = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.call('osInfo', name)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    DeviceManagerService.prototype.devModeToken = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.call('devModeToken', name)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    DeviceManagerService.prototype.listCrashReports = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.call('listCrashReports', name)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    DeviceManagerService.prototype.zcat = function (name, path) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.call('zcat', name, path)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    DeviceManagerService.prototype.extendDevMode = function (device) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.call('extendDevMode', device)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    DeviceManagerService.prototype.onDevicesUpdated = function (devices) {
        var _a;
        this.devicesSubject.next(devices);
        this.selectedSubject.next((_a = devices.find(function (device) { return device.default; })) !== null && _a !== void 0 ? _a : devices[0]);
    };
    DeviceManagerService = __decorate([
        (0, core_1.Injectable)({
            providedIn: 'root'
        }),
        __metadata("design:paramtypes", [electron_service_1.ElectronService, http_1.HttpClient])
    ], DeviceManagerService);
    return DeviceManagerService;
}(ipc_client_1.IpcClient));
exports.DeviceManagerService = DeviceManagerService;
var CrashReport = /** @class */ (function () {
    function CrashReport(device, path) {
        this.device = device;
        this.path = path;
        this.path = path;
        this.name = path.substring(path.lastIndexOf('/') + 1);
        this.subject = new rxjs_1.ReplaySubject(1);
        this.content = this.subject.asObservable();
    }
    CrashReport.prototype.load = function (dm) {
        var _this = this;
        dm.zcat(this.device, this.path)
            .then(function (content) { return _this.subject.next(content.trim()); })
            .catch(function (error) { return _this.subject.error(error); });
    };
    return CrashReport;
}());
exports.CrashReport = CrashReport;
//# sourceMappingURL=device-manager.service.js.map