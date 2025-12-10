/**
 * Package: commands - dynamic command loader
 *
 * Loads command modules from two locations at startup:
 * - `data/commands` (runtime-extensible JS/YAML commands)
 * - `dist/src/commands` (compiled built-in commands)
 *
 * Each command file should export a named `command` constant with:
 * - `pattern: string` - the command pattern
 * - `aliases?: string[]` - optional aliases
 * - `execute(context, args)` - handler function
 * - `onError?(context, result)` - optional error handler
 *
 * Files beginning with `_` are ignored. `.js` and `.yaml` files are loaded.
 * The loader logs progress and registers commands using `registerCommand()`.
 *
 * @example
 * // data/commands/say.js
 * export const command = {
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
	registerCommand,
	getCommands,
} from "../core/command.js";
import { Package } from "package-loader";
import { readdir, readFile, stat } from "fs/promises";
import { join, relative } from "path";
import { pathToFileURL } from "url";
import { runInNewContext } from "vm";
import YAML from "js-yaml";
import logger from "../logger.js";
import { MESSAGE_GROUP } from "../core/character.js";
import {
	forEachCharacter,
	broadcast,
	announce,
	forEachSession,
	getGameStats,
} from "../game.js";
import { access } from "fs/promises";
import { constants } from "fs";
import {
	SOCIAL_COMMANDS,
	getSocialCommandNames,
	type SocialDefinition,
} from "../social.js";
import { executeSocial, onSocialError } from "../commands/_social.js";
import { Mob } from "../core/dungeon.js";
import { getSafeRootDirectory } from "../utils/path.js";

export interface CommandObject {
	pattern: string;
	aliases?: string[];
	priority?: PRIORITY;
	adminOnly?: boolean;
	cooldown?:
		| number
		| ((context: CommandContext, args: Map<string, any>) => number | undefined);
	execute: (context: CommandContext, args: Map<string, any>) => void;
	onError?: (context: CommandContext, result: ParseResult) => void;
}

export interface YAMLCommandDefinition {
	pattern: string;
	aliases?: string[];
	execute: string;
	onError?: string;
}

export class JavaScriptCommandAdapter extends Command {
	private executeFunction: (
		context: CommandContext,
		args: Map<string, any>
	) => void;
	private errorFunction?: (
		context: CommandContext,
		result: ParseResult
	) => void;
	private cooldownResolver?: (
		context: CommandContext,
		args: Map<string, any>
	) => number | undefined;

	constructor(commandObj: CommandObject) {
		super({
			pattern: commandObj.pattern,
			aliases: commandObj.aliases,
			priority: commandObj.priority,
			adminOnly: commandObj.adminOnly,
		});
		this.executeFunction = commandObj.execute;
		this.errorFunction = commandObj.onError;
		if (typeof commandObj.cooldown === "function") {
			this.cooldownResolver = commandObj.cooldown;
		} else if (typeof commandObj.cooldown === "number") {
			const value = commandObj.cooldown;
			this.cooldownResolver = () => value;
		}
	}

	execute(context: CommandContext, args: Map<string, any>): void {
		this.executeFunction(context, args);
	}

	onError(context: CommandContext, result: ParseResult): void {
		if (this.errorFunction) {
			this.errorFunction(context, result);
		}
		// If no error handler, do nothing - the registry will treat this as unmatched
	}

	override getActionCooldownMs(
		context: CommandContext,
		args: Map<string, any>
	): number | undefined {
		if (!this.cooldownResolver) return undefined;
		const value = this.cooldownResolver(context, args);
		return typeof value === "number" ? value : undefined;
	}
}

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
			// Provide access to game functions for global operations
			game: {
				forEachCharacter,
				broadcast,
				announce,
				forEachSession,
				getGameStats,
			},
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
		}
		// If no error handler, do nothing - the registry will treat this as unmatched
	}
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

/** Directory for runtime command files (user-editable) */
const ROOT_DIRECTORY = getSafeRootDirectory();
const DATA_DIRECTORY = join(ROOT_DIRECTORY, "data");
const DATA_COMMAND_DIRECTORY = join(DATA_DIRECTORY, "commands");
/** Directory for compiled built-in commands */
const SRC_COMMAND_DIRECTORY = join(ROOT_DIRECTORY, "dist", "src", "commands");

async function loadCommands() {
	const directories = [DATA_COMMAND_DIRECTORY, SRC_COMMAND_DIRECTORY];
	for (const commandDir of directories) {
		if (!(await fileExists(commandDir))) continue;
		logger.info(
			`Loading commands from ${relative(ROOT_DIRECTORY, commandDir)}`
		);
		try {
			const files = await readdir(commandDir);
			logger.debug(
				`Found ${files.length} files in ${relative(ROOT_DIRECTORY, commandDir)}`
			);

			// Filter for JavaScript files
			const jsFiles = files.filter(
				(file) => file.endsWith(".js") && !file.startsWith("_")
			);
			logger.debug(
				`Found ${jsFiles.length} JavaScript command files in ${relative(
					ROOT_DIRECTORY,
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
					ROOT_DIRECTORY,
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
						`Importing command from ${relative(ROOT_DIRECTORY, filePath)}`
					);*/
					const commandModule = await import(fileUrl);
					const commandObj = commandModule.command;

					if (!commandObj) {
						logger.warn(
							`Command file ${relative(
								ROOT_DIRECTORY,
								filePath
							)} must export a named 'command' constant`
						);
						continue;
					}

					if (commandObj.pattern && commandObj.execute) {
						const command = new JavaScriptCommandAdapter(commandObj);
						registerCommand(command);
						logger.debug(
							`Loaded command "${commandObj.pattern}" from ${relative(
								ROOT_DIRECTORY,
								filePath
							)}`
						);
						if (commandObj.aliases) {
							logger.debug(`  Aliases: ${commandObj.aliases.join(", ")}`);
						}
					} else {
						logger.warn(
							`Invalid command structure in ${relative(
								ROOT_DIRECTORY,
								filePath
							)}: missing pattern or execute function`
						);
					}
				} catch (error) {
					logger.error(
						`Failed to load command from ${relative(
							ROOT_DIRECTORY,
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
						`Loading YAML command from ${relative(ROOT_DIRECTORY, filePath)}`
					);

					const fileContent = await readFile(filePath, "utf-8");
					const yamlDef = YAML.load(fileContent) as YAMLCommandDefinition;

					if (yamlDef && yamlDef.pattern && yamlDef.execute) {
						const command = new YAMLCommandAdapter(yamlDef);
						registerCommand(command);
						logger.info(
							`Loaded YAML command "${yamlDef.pattern}" from ${relative(
								ROOT_DIRECTORY,
								filePath
							)}`
						);
						if (yamlDef.aliases) {
							logger.debug(`  Aliases: ${yamlDef.aliases.join(", ")}`);
						}
					} else {
						logger.warn(
							`Invalid YAML command structure in ${relative(
								ROOT_DIRECTORY,
								filePath
							)}: missing pattern or execute`
						);
					}
				} catch (error) {
					logger.error(
						`Failed to load YAML command from ${relative(
							ROOT_DIRECTORY,
							join(commandDir, file)
						)}: ${error}`
					);
				}
			}
		} catch (error) {
			logger.warn(
				`Failed to read commands directory ${relative(
					ROOT_DIRECTORY,
					commandDir
				)}: ${error}`
			);
		}
	}
	// Generate social commands from social.ts definitions
	await generateSocialCommands();

	logger.debug(
		`Command loading complete. Total commands registered: ${
			getCommands().length
		}`
	);
}

/**
 * Generates and registers social commands from social.ts definitions.
 */
async function generateSocialCommands(): Promise<void> {
	logger.info("Generating social commands from social.ts definitions");

	for (const commandName of getSocialCommandNames()) {
		const socialDef = SOCIAL_COMMANDS[commandName];
		if (!socialDef) continue;

		const requiresTarget = socialDef.requiresTarget ?? false;
		const pattern = requiresTarget
			? `${commandName}~ <target:mob>`
			: `${commandName}~ <target:mob?>`;

		const commandObj: CommandObject = {
			pattern,
			priority: PRIORITY.LOW,
			execute(context: CommandContext, args: Map<string, any>): void {
				const target = args.get("target") as Mob | undefined;
				executeSocial(context, target, {
					messages: socialDef.messages,
				});
			},
			onError(context: CommandContext, result: ParseResult): void {
				if (
					requiresTarget &&
					result.error?.includes("Missing required argument")
				) {
					context.actor.sendMessage(
						`Who do you want to ${commandName}?`,
						MESSAGE_GROUP.COMMAND_RESPONSE
					);
					return;
				}
				onSocialError(context, result);
			},
		};

		const command = new JavaScriptCommandAdapter(commandObj);
		registerCommand(command);
		logger.debug(`Generated social command: ${pattern}`);
	}

	logger.info(`Generated ${getSocialCommandNames().length} social commands`);
}

export default {
	name: "commands",
	loader: async () => {
		await loadCommands();
	},
} as Package;
