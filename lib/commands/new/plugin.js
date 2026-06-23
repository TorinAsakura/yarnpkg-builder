"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fslib_1 = require("@yarnpkg/fslib");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const clipanion_1 = require("clipanion");
const path_1 = tslib_1.__importDefault(require("path"));
// eslint-disable-next-line arca/no-default-export
class NewPluginCommand extends clipanion_1.Command {
    constructor() {
        super(...arguments);
        this.target = clipanion_1.Option.String();
    }
    async execute() {
        const target = fslib_1.npath.toPortablePath(path_1.default.resolve(this.target));
        if (await fslib_1.xfs.existsPromise(target)) {
            const listing = await fslib_1.xfs.readdirPromise(target);
            if (listing.length !== 0) {
                throw new clipanion_1.UsageError(`The target directory (${this.target}) isn't empty; aborting the scaffolding.`);
            }
        }
        await fslib_1.xfs.mkdirPromise(target, { recursive: true });
        await fslib_1.xfs.mkdirPromise(fslib_1.ppath.join(target, `sources`), { recursive: true });
        await fslib_1.xfs.writeFilePromise(fslib_1.ppath.join(target, `sources`, `index.ts`), [
            `import {Plugin} from '@yarnpkg/core';\n`,
            `import {BaseCommand} from '@yarnpkg/cli';\n`,
            `import {Option} from 'clipanion';\n`,
            `\n`,
            `class HelloWorldCommand extends BaseCommand {\n`,
            `  static paths = [\n`,
            `    [\`hello\`, \`world\`],\n`,
            `  ];\n`,
            `\n`,
            `  name = Option.String(\`--name\`, \`John Doe\`, {\n`,
            `    description: \`Your name\`,\n`,
            `  });\n`,
            `\n`,
            `  async execute() {\n`,
            `    console.log(\`Hello \${this.name}!\`);\n`,
            `  }\n`,
            `}\n`,
            `\n`,
            `const plugin: Plugin = {\n`,
            `  hooks: {\n`,
            `    afterAllInstalled: () => {\n`,
            `      console.log(\`What a great install, am I right?\`);\n`,
            `    },\n`,
            `  },\n`,
            `  commands: [\n`,
            `    HelloWorldCommand,\n`,
            `  ],\n`,
            `};\n`,
            `\n`,
            `export default plugin;\n`,
        ].join(``));
        await fslib_1.xfs.writeFilePromise(fslib_1.ppath.join(target, `.gitignore`), `bundles/\n`);
        await fslib_1.xfs.writeJsonPromise(fslib_1.ppath.join(target, `package.json`), {
            name: `yarn-plugin-helloworld`,
            private: true,
            main: `./sources/index.ts`,
            dependencies: {
                [`@yarnpkg/cli`]: require(`@yarnpkg/builder/package.json`).dependencies[`@yarnpkg/cli`],
                [`@yarnpkg/core`]: require(`@yarnpkg/builder/package.json`).dependencies[`@yarnpkg/core`],
                [`clipanion`]: require(`@yarnpkg/builder/package.json`).dependencies.clipanion,
            },
            devDependencies: {
                [`@types/node`]: `^${process.versions.node.split(`.`)[0]}.0.0`,
                [`@yarnpkg/builder`]: `^${require(`@yarnpkg/builder/package.json`).version}`,
                [`rimraf`]: `5.0.0`,
                [`typescript`]: require(`@yarnpkg/builder/package.json`).devDependencies.typescript,
            },
            scripts: {
                [`build`]: `builder build plugin`,
                [`build:dev`]: `builder build plugin --no-minify`,
                [`clean`]: `rimraf bundles`,
            },
        });
        await fslib_1.xfs.writeJsonPromise(fslib_1.ppath.join(target, `tsconfig.json`), {
            compilerOptions: {
                experimentalDecorators: true,
                module: `commonjs`,
                target: `ES2021`,
                lib: [`ES2021`],
            },
            include: [
                `sources/**/*.ts`,
            ],
        });
        this.context.stdout.write(`Scaffolding done! Just go into ${chalk_1.default.magenta(fslib_1.npath.fromPortablePath(target))} and run ${chalk_1.default.cyan(`yarn && yarn build`)} 🙂\n`);
    }
}
NewPluginCommand.paths = [
    [`new`, `plugin`],
];
NewPluginCommand.usage = clipanion_1.Command.Usage({
    description: `generate the template for a new plugin`,
    details: `
      This command generates a new plugin based on the template.

      For more details about the build process, please consult the \`@yarnpkg/builder\` README: https://github.com/yarnpkg/berry/blob/HEAD/packages/yarnpkg-builder/README.md.
    `,
    examples: [[
            `Create a new plugin`,
            `$0 new plugin yarn-plugin-hello-world`,
        ]],
});
exports.default = NewPluginCommand;
