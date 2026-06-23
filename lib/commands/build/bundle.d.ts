import { Command, Usage } from 'clipanion';
export default class BuildBundleCommand extends Command {
    static paths: string[][];
    static usage: Usage;
    profile: string;
    plugins: string[];
    noGitHash: boolean;
    noMinify: boolean;
    sourceMap: boolean;
    metafile: boolean;
    format: string;
    target: string;
    external: string[];
    externalFile: string | undefined;
    execute(): Promise<0 | 1>;
}
