"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDynamicLib = void 0;
const cli_1 = require("@yarnpkg/cli");
const isDynamicLib = (request) => {
    if ((0, cli_1.getDynamicLibs)().has(request))
        return true;
    if (request.match(/^@yarnpkg\/plugin-/))
        return true;
    return false;
};
exports.isDynamicLib = isDynamicLib;
