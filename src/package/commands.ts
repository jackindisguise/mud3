/**
 * Package: commands - dynamic command loader
 *
 * Loads command modules from two locations at startup:
 * - `data/commands` (runtime-extensible JS/YAML commands)
 * - `dist/src/commands` (compiled built-in commands)
 *
 * Each command file should export a default plain object with:
 * - `pattern: string` - the command pattern
 * - `aliases?: string[]` - optional aliases
 * - `execute(context, args)` - handler function
 * - `onError?(context, result)` - optional error handler
 *
 * Files beginning with `_` are ignored. `.js` and `.yaml` files are loaded.
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
	PRIORITY,
} from "../command.js";
import { Package } from "package-loader";
import { readdir, readFile } from "fs/promises";
import { join, relative } from "path";
import { pathToFileURL } from "url";
import { runInNewContext } from "vm";
import YAML from "js-yaml";
import logger from "../logger.js";
import { MESSAGE_GROUP } from "../character.js";
import { Game } from "../game.js";

/**
 * Interface for command objects (JavaScript or TypeScript plain objects)
 */
export interface CommandObject {
	/** Command matching pattern */
	pattern: string;
	/** Optional aliases for the command */
	aliases?: string[];
	/** Priority level for command execution order */
	priority?: PRIORITY;
	/** Execute handler invoked after successful parse */
	execute: (context: CommandContext, args: Map<string, any>) => void;
	/** Optional parse error handler */
	onError?: (context: CommandContext, result: ParseResult) => void;
}

/**
 * Interface for YAML command structure
 */
export interface YAMLCommandDefinition {
	/** Command matching pattern */
	pattern: string;
	/** Optional aliases for the command */
	aliases?: string[];
	/** Execute script as string (run in VM sandbox) */
	execute: string;
	/** Optional error handler script as string (run in VM sandbox) */
	onError?: string;
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
		super({
			pattern: commandObj.pattern,
			aliases: commandObj.aliases,
			priority: commandObj.priority,
		});
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

/**
 * Adapter class to convert YAML command definitions into Command instances.
 * Executes command scripts in a sandboxed VM environment with minimal access.
 */
export class YAMLCommandAdapter extends Command {
	private executeScript: string;
	private errorScript?: string;

	constructor(yamlDef: YAMLCommandDefinition) {
		super({ pattern: yamlDef.pattern, aliases: yamlDef.aliases });
		this.executeScript = yamlDef.execute;
		this.errorScript = yamlDef.onError;
	}

	/**
	 * Creates a sandboxed context for executing command scripts.
	 * Provides minimal access to only what's needed for command execution.
	 */
	private createSandbox(
		context: CommandContext,
		args: Map<string, any>,
		result?: ParseResult
	): any {
		return {
			// Provide access to parsed arguments
			args,
			// Provide access to the actor (player executing the command)
			actor: context.actor,
			// Provide access to the current room if available
			room: context.room,
			// Provide MESSAGE_GROUP enum for message routing
			MESSAGE_GROUP,
			// Provide access to game instance for global operations
			game: Game.game,
			// If this is an error handler, provide the parse result
			result,
			// Provide console for debugging (consider removing in production)
			console: {
				log: (...args: any[]) =>
					logger.debug(`[YAML Command] ${args.join(" ")}`),
				error: (...args: any[]) =>
					logger.error(`[YAML Command] ${args.join(" ")}`),
			},
		};
	}

	execute(context: CommandContext, args: Map<string, any>): void {
		try {
			const sandbox = this.createSandbox(context, args);
			runInNewContext(this.executeScript, sandbox, {
				timeout: 5000, // 5 second timeout
				displayErrors: true,
			});
		} catch (error) {
			logger.error(
				`YAML command execution error in pattern "${this.pattern}": ${error}`
			);
			context.actor.sendLine("An error occurred while executing the command.");
		}
	}

	onError(context: CommandContext, result: ParseResult): void {
		if (this.errorScript) {
			try {
				const sandbox = this.createSandbox(context, new Map(), result);
				runInNewContext(this.errorScript, sandbox, {
					timeout: 5000, // 5 second timeout
					displayErrors: true,
				});
			} catch (error) {
				logger.error(
					`YAML command error handler failed in pattern "${this.pattern}": ${error}`
				);
				context.actor.sendLine(result.error ?? "Invalid command");
			}
		} else {
			logger.error(`Command error: ${result.error}`);
		}
	}
}

/** Directory for runtime command files (user-editable) */
const DATA_COMMAND_DIRECTORY = join(process.cwd(), "data", "commands");
/** Directory for compiled built-in commands */
const SRC_COMMAND_DIRECTORY = join(process.cwd(), "dist", "src", "commands");

async function loadCommands() {
	const directories = [DATA_COMMAND_DIRECTORY, SRC_COMMAND_DIRECTORY];
	for (const commandDir of directories) {
		logger.info(`Loading commands from ${relative(process.cwd(), commandDir)}`);
		try {
			const files = await readdir(commandDir);
			logger.debug(
				`Found ${files.length} files in ${relative(process.cwd(), commandDir)}`
			);

			// Filter for JavaScript files
			const jsFiles = files.filter(
				(file) => file.endsWith(".js") && !file.startsWith("_")
			);
			logger.debug(
				`Found ${jsFiles.length} JavaScript command files in ${relative(
					process.cwd(),
					commandDir
				)}`
			);

			// Filter for YAML files
			const yamlFiles = files.filter(
				(file) =>
					(file.endsWith(".yaml") || file.endsWith(".yml")) &&
					!file.startsWith("_")
			);
			logger.debug(
				`Found ${yamlFiles.length} YAML command files in ${relative(
					process.cwd(),
					commandDir
				)}`
			);

			// Load JavaScript commands
			for (const file of jsFiles) {
				//logger.debug(`Processing command file: ${file}`);
				try {
					const filePath = join(commandDir, file);
					const fileUrl = pathToFileURL(filePath).href;
					/*logger.debug(
						`Importing command from ${relative(process.cwd(), filePath)}`
					);*/
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

			// Load YAML commands
			for (const file of yamlFiles) {
				logger.debug(`Processing YAML command file: ${file}`);
				try {
					const filePath = join(commandDir, file);
					logger.debug(
						`Loading YAML command from ${relative(process.cwd(), filePath)}`
					);

					const fileContent = await readFile(filePath, "utf-8");
					const yamlDef = YAML.load(fileContent) as YAMLCommandDefinition;

					if (yamlDef && yamlDef.pattern && yamlDef.execute) {
						const command = new YAMLCommandAdapter(yamlDef);
						CommandRegistry.default.register(command);
						logger.info(
							`Loaded YAML command "${yamlDef.pattern}" from ${relative(
								process.cwd(),
								filePath
							)}`
						);
						if (yamlDef.aliases) {
							logger.debug(`  Aliases: ${yamlDef.aliases.join(", ")}`);
						}
					} else {
						logger.warn(
							`Invalid YAML command structure in ${relative(
								process.cwd(),
								filePath
							)}: missing pattern or execute`
						);
					}
				} catch (error) {
					logger.error(
						`Failed to load YAML command from ${relative(
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
}

export default {
	name: "commands",
	loader: async () => {
		logger.info("================================================");
		logger.info("Loading command definitions...");
		await loadCommands();
		logger.info("================================================");
	},
} as Package;
