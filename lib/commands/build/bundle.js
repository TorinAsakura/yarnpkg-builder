"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const cli_1 = require("@yarnpkg/cli");
const core_1 = require("@yarnpkg/core");
const fslib_1 = require("@yarnpkg/fslib");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const child_process_1 = tslib_1.__importDefault(require("child_process"));
const clipanion_1 = require("clipanion");
const esbuild_1 = require("esbuild");
const module_1 = require("module");
const path_1 = tslib_1.__importDefault(require("path"));
const semver_1 = tslib_1.__importDefault(require("semver"));
const util_1 = require("util");
const package_json_1 = tslib_1.__importDefault(require("../../../package.json"));
const findPlugins_1 = require("../../tools/findPlugins");
const getExternalDependencies_1 = require("../../tools/getExternalDependencies");
const execFile = (0, util_1.promisify)(child_process_1.default.execFile);
const BUNDLE_FORMATS = new Set([`iife`, `esm`]);
const defaultBundleTarget = `node${semver_1.default.minVersion(package_json_1.default.engines.node).version}`;
const pkgJsonVersion = (basedir) => {
    return require(`${basedir}/package.json`).version;
};
const suggestHash = async (basedir) => {
    try {
        const unique = await execFile(`git`, [`show`, `-s`, `--pretty=format:%ad.%h`, `--date=short`], { cwd: basedir });
        return `git.${unique.stdout.trim().replace(/-/g, ``).replace(`.`, `.hash-`)}`;
    }
    catch {
        return null;
    }
};
const getBundleFormat = (format) => {
    if (!BUNDLE_FORMATS.has(format))
        throw new clipanion_1.UsageError(`Invalid bundle format "${format}", expected one of ${[...BUNDLE_FORMATS].join(`, `)}`);
    return format;
};
const getBundleBanner = (format) => {
    const esmRequireShim = `
await (async () => {
  const {dirname} = await import("path");
  const {fileURLToPath} = await import("url");

  if (typeof globalThis.__filename === "undefined") {
    globalThis.__filename = fileURLToPath(import.meta.url);
  }
  if (typeof globalThis.__dirname === "undefined") {
    globalThis.__dirname = dirname(globalThis.__filename);
  }
  if (typeof globalThis.require === "undefined") {
    const {default: module} = await import("module");
    globalThis.require = module.createRequire(import.meta.url);
  }
})();
`;
    return [
        `#!/usr/bin/env node`,
        `/* eslint-disable */`,
        `//prettier-ignore`,
        format === `esm` ? esmRequireShim : null,
    ].filter((line) => line !== null).join(`\n`);
};
// eslint-disable-next-line arca/no-default-export
class BuildBundleCommand extends clipanion_1.Command {
    constructor() {
        super(...arguments);
        this.profile = clipanion_1.Option.String(`--profile`, `standard`, {
            description: `Only include plugins that are part of the the specified profile`,
        });
        this.plugins = clipanion_1.Option.Array(`--plugin`, [], {
            description: `An array of plugins that should be included besides the ones specified in the profile`,
        });
        this.noGitHash = clipanion_1.Option.Boolean(`--no-git-hash`, false, {
            description: `Don't include the git hash of the current commit in bundle version`,
        });
        this.noMinify = clipanion_1.Option.Boolean(`--no-minify`, false, {
            description: `Build a bundle for development, without optimizations (minifying, mangling, treeshaking)`,
        });
        this.sourceMap = clipanion_1.Option.Boolean(`--source-map`, false, {
            description: `Includes a source map in the bundle`,
        });
        this.metafile = clipanion_1.Option.Boolean(`--metafile`, false, {
            description: `Emit a metafile next to the bundle`,
        });
        this.format = clipanion_1.Option.String(`--format`, `iife`, {
            description: `Bundle output format`,
        });
        this.target = clipanion_1.Option.String(`--target`, defaultBundleTarget, {
            description: `Bundle compilation target`,
        });
        this.external = clipanion_1.Option.Array(`--external`, [], {
            description: `Dependencies that should remain external in the bundle`,
        });
        this.externalFile = clipanion_1.Option.String(`--external-file`, {
            description: `Path to a JSON file listing dependencies that should remain external in the bundle`,
        });
    }
    async execute() {
        const basedir = process.cwd();
        const portableBaseDir = fslib_1.npath.toPortablePath(basedir);
        const configuration = core_1.Configuration.create(portableBaseDir);
        const plugins = (0, findPlugins_1.findPlugins)({ basedir, profile: this.profile, plugins: this.plugins.map(plugin => path_1.default.resolve(plugin)) });
        const modules = [...(0, cli_1.getDynamicLibs)().keys()].concat(plugins);
        const output = fslib_1.ppath.join(portableBaseDir, `bundles/yarn.js`);
        const metafile = this.metafile ? fslib_1.ppath.join(portableBaseDir, `bundles/yarn.meta.json`) : false;
        const format = getBundleFormat(this.format);
        let version = pkgJsonVersion(basedir);
        const hash = !this.noGitHash
            ? await suggestHash(basedir)
            : null;
        if (hash !== null)
            version = semver_1.default.prerelease(version) !== null
                ? `${version}.${hash}`
                : `${version}-${hash}`;
        const report = await core_1.StreamReport.start({
            configuration,
            includeFooter: false,
            stdout: this.context.stdout,
        }, async (report) => {
            await report.startTimerPromise(`Building the CLI`, async () => {
                const valLoad = (p, values) => {
                    const fn = require(p.replace(/.ts$/, `.val.js`));
                    return fn(values).code;
                };
                const valLoader = {
                    name: `val-loader`,
                    setup(build) {
                        build.onLoad({ filter: /[\\/]getPluginConfiguration\.ts$/ }, async (args) => ({
                            contents: valLoad(args.path, { modules, plugins }),
                            loader: `default`,
                        }));
                    },
                };
                const res = await (0, esbuild_1.build)({
                    banner: {
                        js: getBundleBanner(format),
                    },
                    entryPoints: [path_1.default.join(basedir, `sources/cli.ts`)],
                    bundle: true,
                    define: {
                        YARN_VERSION: JSON.stringify(version),
                        ...(this.noMinify ? {} : {
                            // For React
                            'process.env.NODE_ENV': JSON.stringify(`production`),
                            // For ink
                            'process.env.DEV': JSON.stringify(`false`),
                            // mkdirp
                            'process.env.__TESTING_MKDIRP_PLATFORM__': `false`,
                            'process.env.__TESTING_MKDIRP_NODE_VERSION__': `false`,
                            'process.env.__FAKE_PLATFORM__': `false`,
                        }),
                    },
                    outfile: fslib_1.npath.fromPortablePath(output),
                    metafile: metafile !== false,
                    // Default extensions + .mjs
                    resolveExtensions: [`.tsx`, `.ts`, `.jsx`, `.mjs`, `.js`, `.css`, `.json`],
                    logLevel: `silent`,
                    format,
                    platform: `node`,
                    plugins: [valLoader],
                    minify: !this.noMinify,
                    sourcemap: this.sourceMap ? `inline` : false,
                    target: this.target,
                    external: (0, getExternalDependencies_1.getExternalDependencies)({
                        cwd: basedir,
                        external: this.external,
                        externalFile: this.externalFile,
                    }),
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
                await fslib_1.xfs.chmodPromise(output, 0o755);
                if (metafile) {
                    await fslib_1.xfs.writeFilePromise(metafile, JSON.stringify(res.metafile));
                }
            });
        });
        report.reportSeparator();
        const Mark = core_1.formatUtils.mark(configuration);
        if (report.hasErrors()) {
            report.reportError(core_1.MessageName.EXCEPTION, `${Mark.Cross} Failed to build the CLI`);
        }
        else {
            report.reportInfo(null, `${Mark.Check} Done building the CLI!`);
            report.reportInfo(null, `${Mark.Question} Bundle path: ${core_1.formatUtils.pretty(configuration, output, core_1.formatUtils.Type.PATH)}`);
            report.reportInfo(null, `${Mark.Question} Bundle size: ${core_1.formatUtils.pretty(configuration, (await fslib_1.xfs.statPromise(output)).size, core_1.formatUtils.Type.SIZE)}`);
            report.reportInfo(null, `${Mark.Question} Bundle version: ${core_1.formatUtils.pretty(configuration, version, core_1.formatUtils.Type.REFERENCE)}`);
            if (metafile)
                report.reportInfo(null, `${Mark.Question} Bundle meta: ${core_1.formatUtils.pretty(configuration, metafile, core_1.formatUtils.Type.PATH)}`);
            report.reportSeparator();
            const basedirReq = (0, module_1.createRequire)(`${basedir}/package.json`);
            for (const plugin of plugins) {
                const { name } = basedirReq(`${plugin}/package.json`);
                report.reportInfo(null, `${chalk_1.default.yellow(`→`)} ${core_1.structUtils.prettyIdent(configuration, core_1.structUtils.parseIdent(name))}`);
            }
        }
        return report.exitCode();
    }
}
BuildBundleCommand.paths = [
    [`build`, `bundle`],
];
BuildBundleCommand.usage = clipanion_1.Command.Usage({
    description: `build the local bundle`,
    details: `
      This command builds the local bundle - the Yarn binary file that is installed in projects.

      For more details about the build process, please consult the \`@yarnpkg/builder\` README: https://github.com/yarnpkg/berry/blob/HEAD/packages/yarnpkg-builder/README.md.
    `,
    examples: [[
            `Build the local bundle`,
            `$0 build bundle`,
        ], [
            `Build the local development bundle`,
            `$0 build bundle --no-minify`,
        ]],
});
exports.default = BuildBundleCommand;
