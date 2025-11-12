/**
 * Changes board command alias.
 *
 * Acts as an alias for "board changes".
 *
 * @example
 * ```
 * changes           // List all messages on changes board
 * changes read 5    // Read message #5 from changes board
 * changes write     // Start writing a message to changes board
 * ```
 *
 * **Pattern:** `changes <action:word?> <id:word?>`
 * @module commands/changes
 */

import { CommandContext } from "../command.js";
import { CommandObject } from "../package/commands.js";
import boardCommand from "./board.js";

export default {
	pattern: "changes <action:word?> <id:word?>",
	async execute(context: CommandContext, args: Map<string, any>) {
		// Create new args map with boardname pre-filled
		const newArgs = new Map<string, any>();
		newArgs.set("boardname", "changes");
		newArgs.set("action", args.get("action"));
		newArgs.set("id", args.get("id"));

		// Call the board command's execute function
		await boardCommand.execute(context, newArgs);
	},
} as CommandObject;
