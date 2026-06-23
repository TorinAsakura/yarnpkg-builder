"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExternalDependencies = void 0;
const tslib_1 = require("tslib");
const clipanion_1 = require("clipanion");
const fs_1 = require("fs");
const path_1 = tslib_1.__importDefault(require("path"));
const getExternalDependencies = ({ cwd, external, externalFile }) => {
    if (typeof externalFile === `undefined`)
        return external;
    const externalFilePath = path_1.default.isAbsolute(externalFile)
        ? externalFile
        : path_1.default.resolve(cwd, externalFile);
    const parsed = JSON.parse((0, fs_1.readFileSync)(externalFilePath, `utf8`));
    if (!Array.isArray(parsed) || !parsed.every(value => typeof value === `string`))
        throw new clipanion_1.UsageError(`External dependency file must contain a JSON array of strings`);
    return [...external, ...parsed];
};
exports.getExternalDependencies = getExternalDependencies;
