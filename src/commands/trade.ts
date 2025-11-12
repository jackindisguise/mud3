/**
 * Trade board command alias.
 *
 * Acts as an alias for "board trade".
 *
 * @example
 * ```
 * trade             // List all messages on trade board
 * trade read 5       // Read message #5 from trade board
 * trade write        // Start writing a message to trade board
 * ```
 *
 * **Pattern:** `trade <action:word?> <id:word?>`
 * @module commands/trade
 */

import { CommandContext } from "../command.js";
import { CommandObject } from "../package/commands.js";
import boardCommand from "./board.js";

export default {
	pattern: "trade <action:word?> <id:word?>",
	async execute(context: CommandContext, args: Map<string, any>) {
		// Create new args map with boardname pre-filled
		const newArgs = new Map<string, any>();
		newArgs.set("boardname", "trade");
		newArgs.set("action", args.get("action"));
		newArgs.set("id", args.get("id"));

		// Call the board command's execute function
		await boardCommand.execute(context, newArgs);
	},
} as CommandObject;
