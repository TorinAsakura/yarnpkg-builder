#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const clipanion_1 = require("clipanion");
const bundle_1 = tslib_1.__importDefault(require("./commands/build/bundle"));
const plugin_1 = tslib_1.__importDefault(require("./commands/build/plugin"));
const plugin_2 = tslib_1.__importDefault(require("./commands/new/plugin"));
const cli = new clipanion_1.Cli({
    binaryLabel: `Yarn Builder`,
    binaryName: `builder`,
    binaryVersion: require(`@yarnpkg/builder/package.json`).version,
});
cli.register(plugin_2.default);
cli.register(bundle_1.default);
cli.register(plugin_1.default);
cli.register(clipanion_1.Builtins.DefinitionsCommand);
cli.register(clipanion_1.Builtins.HelpCommand);
cli.register(clipanion_1.Builtins.VersionCommand);
cli.runExit(process.argv.slice(2), clipanion_1.Cli.defaultContext);
