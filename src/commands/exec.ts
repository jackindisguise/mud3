/**
 * Execute JavaScript code command (admin only).
 *
 * Executes arbitrary JavaScript code provided as a string. This is a powerful
 * debugging and administration tool that allows admins to run code on the fly.
 *
 * @example
 * ```
 * exec console.log("Hello World")
 * exec context.actor.sendMessage("Test", MESSAGE_GROUP.SYSTEM)
 * exec game.broadcast("Server announcement!")
 * ```
 *
 * **Security:** This command is restricted to admin users only.
 * **Pattern:** `exec <code:text>`
 * @module commands/exec
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { Character, MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { runInNewContext } from "vm";
import { inspect } from "util";
import logger from "../logger.js";
import {
	broadcast,
	forEachCharacter,
	announce,
	forEachSession,
	getGameStats,
} from "../game.js";
import { createFromTemplateWithOid } from "../package/dungeon.js";
import { DungeonObject } from "../core/dungeon.js";
import { resolveTemplateById } from "../registry/dungeon.js";

// allows each user to have their own persistant.
const persistance = new Map<Character, Record<string, any>>();
function getPersistance(character: Character): Record<string, any> {
	let data = persistance.get(character);
	if (!data) {
		data = {
			user: character,
			mob: character.mob,
			room: character.mob!.location,
			game: {
				forEachCharacter,
				broadcast,
				announce,
				forEachSession,
				getGameStats,
			},
			createFromTemplate: (templateId: string): DungeonObject | null => {
				const template = resolveTemplateById(templateId);
				if (!template) {
					return null;
				}
				const object = createFromTemplateWithOid(template);
				character.mob?.add(object);
				return object;
			},

			// printing messages directly to user
			print: (...args: any[]) =>
				character.sendMessage(
					`${args.join(" ")}`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				),
			// Provide console for debugging
			console: {
				log: (...args: any[]) => logger.debug(`[Exec] ${args.join(" ")}`),
				error: (...args: any[]) => logger.error(`[Exec] ${args.join(" ")}`),
				warn: (...args: any[]) => logger.warn(`[Exec] ${args.join(" ")}`),
				info: (...args: any[]) => logger.info(`[Exec] ${args.join(" ")}`),
			},
			// Provide util.inspect for better object inspection than JSON.stringify
			inspect: (
				obj: any,
				options?: { depth?: number; colors?: boolean; compact?: boolean }
			) => {
				return inspect(obj, {
					depth: options?.depth ?? 1,
					colors: options?.colors ?? false,
					compact: options?.compact ?? false,
					showHidden: false,
					breakLength: 80,
				});
			},
		};
		persistance.set(character, data);
	}
	return data;
}

export const command = {
	pattern: "exec <code:text>",
	adminOnly: true,
	/**
	 * Execute the JavaScript code.
	 */
	async execute(
		context: CommandContext,
		args: Map<string, any>
	): Promise<void> {
		const code = args.get("code") as string;
		const { actor } = context;
		const character = actor.character;

		// Double-check admin status (shouldn't be needed due to adminOnly flag, but safety check)
		if (!character || !character.isAdmin()) {
			actor.sendMessage(
				"You do not have permission to use this command.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		let message: string;
		let actualCode = code;

		// If code starts with =, treat it as an expression to return
		if (code.startsWith(":")) {
			actualCode = `print(${code.slice(1)})`;
		}

		try {
			// Create a sandboxed context for executing code
			// The context object is available within the executed code
			const sandbox = getPersistance(character);

			// Wrap code in an async function if it contains await
			const wrappedCode = actualCode.includes("await")
				? `(async () => { ${actualCode} })()`
				: actualCode;

			// Execute code in the sandboxed context
			const result = runInNewContext(wrappedCode, sandbox, {
				timeout: 5000, // 5 second timeout
			});

			// Handle promise result if code was async
			const finalResult = result instanceof Promise ? await result : result;

			// Prepare the result message
			if (finalResult !== undefined) {
				message = `Result: ${inspect(finalResult, {
					depth: 1,
					colors: false,
					compact: false,
					showHidden: false,
				})}`;
			} else {
				message = "Code executed successfully (no return value).";
			}
		} catch (error) {
			// Handle execution errors
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			message = `Execution error: ${errorMessage}`;
		}

		actor.sendMessage(message, MESSAGE_GROUP.COMMAND_RESPONSE);
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error === "Missing required argument: code") {
			context.actor.sendMessage(
				"What code do you want to execute?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
		} else {
			context.actor.sendMessage(
				`Error: ${result.error}`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
		}
	},
} satisfies CommandObject;
