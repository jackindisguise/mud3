/**
 * Who command - displays all currently connected players.
 *
 * Shows a list of active player names along with summary statistics about
 * total players online and active connections. Useful for seeing who else
 * is currently in the game.
 *
 * @example
 * ```
 * who
 * w   // autocomplete to "who"
 * wh  // autocomplete to "who"
 * ```
 *
 * **Output:**
 * ```
 * === Players Online ===
 * > username1
 * > username2
 *
 * Total Players: 2
 * Total Connections: 2
 * ```
 *
 * **Pattern:** `who~`
 * @module commands/who
 */

import { CommandContext } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { CommandObject } from "../package/commands.js";
import { Game } from "../game.js";
import { LINEBREAK } from "../telnet.js";

export default {
	pattern: "who~",
	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor } = context;
		const game = Game.game!;

		const stats = game.getGameStats();
		const players: string[] = [];

		// Collect all active player names
		game.forEachCharacter((character) => {
			players.push(character.credentials.username);
		});

		// Build the output
		const lines: string[] = [];
		lines.push("=== Players Online ===");

		if (players.length === 0) {
			lines.push("No players currently online.");
		} else {
			players.forEach((name) => {
				lines.push(`> ${name}`);
			});
		}

		lines.push("");
		lines.push(`Total Players: ${stats.playersOnline}`);
		lines.push(`Total Connections: ${stats.activeConnections}`);

		// Send the formatted output
		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
