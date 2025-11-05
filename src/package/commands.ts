/**
 * Package: commands - dynamic command loader
 *
 * Loads command modules from two locations at startup:
 * - `data/commands` (runtime-extensible JS commands)
 * - `dist/src/commands` (compiled built-in commands)
 *
 * Each command file should export a default plain object with:
 * - `pattern: string` - the command pattern
 * - `aliases?: string[]` - optional aliases
 * - `execute(context, args)` - handler function
 * - `onError?(context, result)` - optional error handler
 *
 * Files beginning with `_` are ignored. Only `.js` files are loaded.
 * The loader logs progress and registers commands into `CommandRegistry.default`.
 *
 * @example
 * // data/commands/say.js
 * export default {
 *   pattern: 'say <...text:any>';
 *   aliases: ['"'],
 *   execute(ctx, args) { ctx.client.sendLine(args.get('text')); }
 * };
 *
 * @module package/commands
 */
import {
	CommandRegistry,
	Command,
	CommandContext,
	ParseResult,
} from "../command.js";
import { Package } from "package-loader";
import { readdir } from "fs/promises";
import { join, relative } from "path";
import { pathToFileURL } from "url";
import logger from "../logger.js";

/**
 * Interface for command objects (JavaScript or TypeScript plain objects)
 */
export interface CommandObject {
	/** Command matching pattern */
	pattern: string;
	/** Optional aliases for the command */
	aliases?: string[];
	/** Execute handler invoked after successful parse */
	execute: (context: CommandContext, args: Map<string, any>) => void;
	/** Optional parse error handler */
	onError?: (context: CommandContext, result: ParseResult) => void;
}

/**
 * Adapter class to convert JavaScript command objects into Command instances
 */
export class JavaScriptCommandAdapter extends Command {
	private executeFunction: (
		context: CommandContext,
		args: Map<string, any>
	) => void;
	private errorFunction?: (
		context: CommandContext,
		result: ParseResult
	) => void;

	constructor(commandObj: CommandObject) {
		super({ pattern: commandObj.pattern, aliases: commandObj.aliases });
		this.executeFunction = commandObj.execute;
		this.errorFunction = commandObj.onError;
	}

	execute(context: CommandContext, args: Map<string, any>): void {
		this.executeFunction(context, args);
	}

	onError(context: CommandContext, result: ParseResult): void {
		if (this.errorFunction) {
			this.errorFunction(context, result);
		} else {
			logger.error(`Command error: ${result.error}`);
		}
	}
}

/** Directory for runtime command files (user-editable) */
const DATA_COMMAND_DIRECTORY = join(process.cwd(), "data", "commands");
/** Directory for compiled built-in commands */
const SRC_COMMAND_DIRECTORY = join(process.cwd(), "dist", "src", "commands");

export default {
	name: "commands",
	loader: async () => {
		const directories = [DATA_COMMAND_DIRECTORY, SRC_COMMAND_DIRECTORY];

		for (const commandDir of directories) {
			logger.info(
				`Loading commands from ${relative(process.cwd(), commandDir)}`
			);
			try {
				const files = await readdir(commandDir);
				logger.debug(
					`Found ${files.length} files in ${relative(
						process.cwd(),
						commandDir
					)}`
				);
				const jsFiles = files.filter(
					(file) => file.endsWith(".js") && !file.startsWith("_")
				);
				logger.debug(
					`Found ${jsFiles.length} JavaScript command files in ${relative(
						process.cwd(),
						commandDir
					)}`
				);

				for (const file of jsFiles) {
					logger.debug(`Processing command file: ${file}`);
					try {
						const filePath = join(commandDir, file);
						const fileUrl = pathToFileURL(filePath).href;
						logger.debug(
							`Importing command from ${relative(process.cwd(), filePath)}`
						);
						const commandModule = await import(fileUrl);
						const commandObj = commandModule.default;

						if (commandObj && commandObj.pattern && commandObj.execute) {
							const command = new JavaScriptCommandAdapter(commandObj);
							CommandRegistry.default.register(command);
							logger.info(
								`Loaded command "${commandObj.pattern}" from ${relative(
									process.cwd(),
									filePath
								)}`
							);
							if (commandObj.aliases) {
								logger.debug(`  Aliases: ${commandObj.aliases.join(", ")}`);
							}
						} else {
							logger.warn(
								`Invalid command structure in ${relative(
									process.cwd(),
									filePath
								)}`
							);
						}
					} catch (error) {
						logger.error(
							`Failed to load command from ${relative(
								process.cwd(),
								join(commandDir, file)
							)}: ${error}`
						);
					}
				}
			} catch (error) {
				logger.warn(
					`Failed to read commands directory ${relative(
						process.cwd(),
						commandDir
					)}: ${error}`
				);
			}
		}
		logger.debug(
			`Command loading complete. Total commands registered: ${
				CommandRegistry.default.getCommands().length
			}`
		);
	},
} as Package;
