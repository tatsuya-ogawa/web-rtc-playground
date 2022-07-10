"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
let AppService = class AppService {
    getTurnCredential(name, secret) {
        const unixTimeStamp = Date.now() / 1000 + 24 * 3600;
        const username = [unixTimeStamp, name].join(':');
        const hmac = (0, node_crypto_1.createHmac)('sha1', secret);
        hmac.setEncoding('base64');
        hmac.write(username);
        hmac.end();
        const password = hmac.read();
        return {
            username: username,
            credential: password,
        };
    }
};
AppService = __decorate([
    (0, common_1.Injectable)()
], AppService);
exports.AppService = AppService;
//# sourceMappingURL=app.service.js.map