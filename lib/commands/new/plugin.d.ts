import { Command, Usage } from 'clipanion';
export default class NewPluginCommand extends Command {
    static paths: string[][];
    static usage: Usage;
    target: string;
    execute(): Promise<void>;
}
