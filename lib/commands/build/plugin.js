"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@yarnpkg/core");
const fslib_1 = require("@yarnpkg/fslib");
const clipanion_1 = require("clipanion");
const esbuild_1 = require("esbuild");
const path_1 = tslib_1.__importDefault(require("path"));
const semver_1 = tslib_1.__importDefault(require("semver"));
const package_json_1 = tslib_1.__importDefault(require("../../../package.json"));
const isDynamicLib_1 = require("../../tools/isDynamicLib");
const matchAll = /()/;
// Splits a require request into its components, or return null if the request is a file path
const pathRegExp = /^(?![a-zA-Z]:[\\/]|\\\\|\.{0,2}(?:\/|$))((?:@[^/]+\/)?[^/]+)\/*(.*|)$/;
// The name gets normalized so that everyone can override some plugins by
// their own (@arcanis/yarn-plugin-foo would override @yarnpkg/plugin-foo
// as well as @mael/yarn-plugin-foo)
const getNormalizedName = (name) => {
    const parsing = name.match(/^(?:@yarnpkg\/|(?:@[^/]+\/)?yarn-)(plugin-[^/]+)/);
    if (parsing === null)
        throw new clipanion_1.UsageError(`Invalid plugin name "${name}" - it should be "yarn-plugin-<something>"`);
    return `@yarnpkg/${parsing[1]}`;
};
// eslint-disable-next-line arca/no-default-export
class BuildPluginCommand extends clipanion_1.Command {
    constructor() {
        super(...arguments);
        this.noMinify = clipanion_1.Option.Boolean(`--no-minify`, false, {
            description: `Build a plugin for development, without optimizations (minifying, mangling, treeshaking)`,
        });
        this.sourceMap = clipanion_1.Option.Boolean(`--source-map`, false, {
            description: `Includes a source map in the bundle`,
        });
        this.metafile = clipanion_1.Option.Boolean(`--metafile`, false, {
            description: `Emit a metafile next to the bundle`,
        });
        this.external = clipanion_1.Option.Array(`--external`, [], {
            description: `Dependencies that should remain external in the bundle`,
        });
    }
    async execute() {
        const basedir = process.cwd();
        const portableBaseDir = fslib_1.npath.toPortablePath(basedir);
        const configuration = core_1.Configuration.create(portableBaseDir);
        const { name: rawName, main } = require(`${basedir}/package.json`);
        const name = getNormalizedName(rawName);
        const prettyName = core_1.structUtils.prettyIdent(configuration, core_1.structUtils.parseIdent(name));
        const output = fslib_1.ppath.join(portableBaseDir, `bundles/${name}.js`);
        const metafile = this.metafile ? fslib_1.ppath.join(portableBaseDir, `bundles/${name}.meta.json`) : false;
        await fslib_1.xfs.mkdirPromise(fslib_1.ppath.dirname(output), { recursive: true });
        const report = await core_1.StreamReport.start({
            configuration,
            includeFooter: false,
            stdout: this.context.stdout,
        }, async (report) => {
            await report.startTimerPromise(`Building ${prettyName}`, async () => {
                const dynamicLibResolver = {
                    name: `dynamic-lib-resolver`,
                    setup(build) {
                        build.onResolve({ filter: matchAll }, async (args) => {
                            const dependencyNameMatch = args.path.match(pathRegExp);
                            if (dependencyNameMatch === null)
                                return undefined;
                            const [, dependencyName] = dependencyNameMatch;
                            if (dependencyName === name || !(0, isDynamicLib_1.isDynamicLib)(args.path))
                                return undefined;
                            return {
                                path: args.path,
                                external: true,
                            };
                        });
                    },
                };
                const res = await (0, esbuild_1.build)({
                    banner: {
                        js: [
                            `/* eslint-disable */`,
                            `//prettier-ignore`,
                            `module.exports = {`,
                            `name: ${JSON.stringify(name)},`,
                            `factory: function (require) {`,
                        ].join(`\n`),
                    },
                    globalName: `plugin`,
                    footer: {
                        js: [
                            `return plugin;`,
                            `}`,
                            `};`,
                        ].join(`\n`),
                    },
                    entryPoints: [path_1.default.resolve(basedir, main ?? `sources/index`)],
                    bundle: true,
                    outfile: fslib_1.npath.fromPortablePath(output),
                    metafile: metafile !== false,
                    // Default extensions + .mjs
                    resolveExtensions: [`.tsx`, `.ts`, `.jsx`, `.mjs`, `.js`, `.css`, `.json`],
                    logLevel: `silent`,
                    format: `iife`,
                    platform: `node`,
                    plugins: [dynamicLibResolver],
                    minify: !this.noMinify,
                    sourcemap: this.sourceMap ? `inline` : false,
                    target: `node${semver_1.default.minVersion(package_json_1.default.engines.node).version}`,
                    external: this.external,
                    supported: {
                        /*
                        Yarn plugin-runtime did not support builtin modules prefixed with "node:".
                        See https://github.com/yarnpkg/berry/pull/5997
                        As a solution, and for backwards compatibility, esbuild should strip these prefixes.
                        */
                        'node-colon-prefix-import': false,
                        'node-colon-prefix-require': false,
                    },
                });
                for (const warning of res.warnings) {
                    if (warning.location !== null)
                        continue;
                    report.reportWarning(core_1.MessageName.UNNAMED, warning.text);
                }
                for (const warning of res.warnings) {
                    if (warning.location === null)
                        continue;
                    report.reportWarning(core_1.MessageName.UNNAMED, `${warning.location.file}:${warning.location.line}:${warning.location.column}`);
                    report.reportWarning(core_1.MessageName.UNNAMED, `   ↳ ${warning.text}`);
                }
                if (metafile) {
                    await fslib_1.xfs.writeFilePromise(metafile, JSON.stringify(res.metafile));
                }
            });
        });
        report.reportSeparator();
        const Mark = core_1.formatUtils.mark(configuration);
        if (report.hasErrors()) {
            report.reportError(core_1.MessageName.EXCEPTION, `${Mark.Cross} Failed to build ${prettyName}`);
        }
        else {
            report.reportInfo(null, `${Mark.Check} Done building ${prettyName}!`);
            report.reportInfo(null, `${Mark.Question} Bundle path: ${core_1.formatUtils.pretty(configuration, output, core_1.formatUtils.Type.PATH)}`);
            report.reportInfo(null, `${Mark.Question} Bundle size: ${core_1.formatUtils.pretty(configuration, (await fslib_1.xfs.statPromise(output)).size, core_1.formatUtils.Type.SIZE)}`);
            if (metafile) {
                report.reportInfo(null, `${Mark.Question} Bundle meta: ${core_1.formatUtils.pretty(configuration, metafile, core_1.formatUtils.Type.PATH)}`);
            }
        }
        return report.exitCode();
    }
}
BuildPluginCommand.paths = [
    [`build`, `plugin`],
];
BuildPluginCommand.usage = clipanion_1.Command.Usage({
    description: `build a local plugin`,
    details: `
      This command builds a local plugin.

      For more details about the build process, please consult the \`@yarnpkg/builder\` README: https://github.com/yarnpkg/berry/blob/HEAD/packages/yarnpkg-builder/README.md.
    `,
    examples: [[
            `Build a local plugin`,
            `$0 build plugin`,
        ], [
            `Build a local development plugin`,
            `$0 build plugin --no-minify`,
        ]],
});
exports.default = BuildPluginCommand;
