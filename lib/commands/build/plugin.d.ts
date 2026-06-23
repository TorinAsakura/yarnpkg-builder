import { Command, Usage } from 'clipanion';
export default class BuildPluginCommand extends Command {
    static paths: string[][];
    static usage: Usage;
    noMinify: boolean;
    sourceMap: boolean;
    metafile: boolean;
    external: string[];
    externalFile: string | undefined;
    execute(): Promise<0 | 1>;
}
