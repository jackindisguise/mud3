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

import { CommandContext, ParseResult } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { CommandObject } from "../package/commands.js";

export default {
	pattern: "exec <code:text>",
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

		// Security check: only admins can use this command
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
		if (code.startsWith("=")) {
			actualCode = `return ${code.slice(1)}`;
		}

		try {
			// Create an async function from the code string and execute it
			// The context object is available within the executed code
			const AsyncFunction = async function () {}
				.constructor as FunctionConstructor;
			const func = AsyncFunction("context", actualCode);
			const result = await func(context);

			// Prepare the result message
			if (result !== undefined) {
				message = `Result: ${JSON.stringify(result, null, 2)}`;
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
