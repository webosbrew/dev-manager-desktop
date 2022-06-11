"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
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
exports.RepositoryPage = exports.RepositoryItem = exports.PackageManifest = exports.AppsRepoService = void 0;
var http_1 = require("@angular/common/http");
var core_1 = require("@angular/core");
var operators_1 = require("rxjs/operators");
var semver = __importStar(require("semver"));
var baseUrl = 'https://repo.webosbrew.org/api';
var AppsRepoService = /** @class */ (function () {
    function AppsRepoService(http) {
        this.http = http;
    }
    AppsRepoService.prototype.showApp = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.http.get(baseUrl + "/apps/" + id + ".json").pipe((0, operators_1.map)(function (body) { return new RepositoryItem(body); })).toPromise()];
            });
        });
    };
    AppsRepoService.prototype.showApps = function () {
        var ids = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            ids[_i] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = Map.bind;
                        return [4 /*yield*/, Promise.all(ids.map(function (id) { return _this.showApp(id).then(function (pkg) { return [pkg.id, pkg]; }).catch(function () { return null; }); }))
                                .then(function (list) { return list.filter(function (v) { return v != null; }); })];
                    case 1: return [2 /*return*/, new (_a.apply(Map, [void 0, _b.sent()]))()];
                }
            });
        });
    };
    AppsRepoService.prototype.allApps$ = function (page) {
        if (page === void 0) { page = 0; }
        var suffix = page > 1 ? "apps/" + page + ".json" : 'apps.json';
        return this.http.get(baseUrl + "/" + suffix).pipe((0, operators_1.map)(function (body) { return new RepositoryPage(body); }));
    };
    AppsRepoService = __decorate([
        (0, core_1.Injectable)({
            providedIn: 'root'
        }),
        __metadata("design:paramtypes", [http_1.HttpClient])
    ], AppsRepoService);
    return AppsRepoService;
}());
exports.AppsRepoService = AppsRepoService;
var PackageManifest = /** @class */ (function () {
    function PackageManifest(data) {
        Object.assign(this, data);
    }
    PackageManifest.prototype.hasUpdate = function (version) {
        if (!version)
            return null;
        var v1 = this.version, v2 = version;
        var segs1 = this.version.split('.', 4), segs2 = version.split('.', 4);
        var suffix1 = '', suffix2 = '';
        if (segs1.length > 3) {
            v1 = segs1.slice(0, 3).join('.');
            suffix1 = segs1[3];
        }
        if (segs2.length > 3) {
            v2 = segs2.slice(0, 3).join('.');
            suffix2 = segs2[3];
        }
        if ((suffix1 || suffix2) && semver.eq(v1, v2, true)) {
            var snum1 = Number(suffix1), snum2 = Number(suffix2);
            if (!isNaN(snum1) && !isNaN(snum2)) {
                return snum1 > snum2;
            }
            return suffix1.localeCompare(suffix2) > 0;
        }
        return semver.gt(v1, v2);
    };
    return PackageManifest;
}());
exports.PackageManifest = PackageManifest;
var RepositoryItem = /** @class */ (function () {
    function RepositoryItem(data) {
        Object.assign(this, data);
        if (data.manifest) {
            this.manifest = new PackageManifest(data.manifest);
        }
        if (data.manifestBeta) {
            this.manifestBeta = new PackageManifest(data.manifestBeta);
        }
    }
    return RepositoryItem;
}());
exports.RepositoryItem = RepositoryItem;
var RepositoryPage = /** @class */ (function () {
    function RepositoryPage(data) {
        var _a;
        this.paging = data.paging;
        this.packages = (_a = data.packages) === null || _a === void 0 ? void 0 : _a.map(function (item) { return new RepositoryItem(item); });
    }
    return RepositoryPage;
}());
exports.RepositoryPage = RepositoryPage;
//# sourceMappingURL=apps-repo.service.js.map