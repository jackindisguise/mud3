/**
 * General board command alias.
 *
 * Acts as an alias for "board general".
 *
 * @example
 * ```
 * general           // List all messages on general board
 * general read 5     // Read message #5 from general board
 * general write      // Start writing a message to general board
 * ```
 *
 * **Pattern:** `general <action:word?> <id:word?>`
 * @module commands/general
 */

import { CommandContext } from "../command.js";
import { CommandObject } from "../package/commands.js";
import boardCommand from "./board.js";

export default {
	pattern: "general <action:word?> <id:word?>",
	async execute(context: CommandContext, args: Map<string, any>) {
		// Create new args map with boardname pre-filled
		const newArgs = new Map<string, any>();
		newArgs.set("boardname", "general");
		newArgs.set("action", args.get("action"));
		newArgs.set("id", args.get("id"));

		// Call the board command's execute function
		await boardCommand.execute(context, newArgs);
	},
} as CommandObject;
