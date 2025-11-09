/**
 * Boards command for listing all available message boards.
 *
 * Shows a list of all message boards with their descriptions
 * and whether they are permanent or time-limited.
 *
 * @example
 * ```
 * boards                    // List all available boards
 * ```
 *
 * **Pattern:** `boards~`
 * @module commands/boards
 */

import { CommandContext } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { CommandObject } from "../package/commands.js";
import { getAllBoards } from "../package/board.js";
import { color, COLOR } from "../color.js";
import { LINEBREAK } from "../telnet.js";

export default {
	pattern: "boards~",
	execute(context: CommandContext): void {
		const { actor } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"Only players can view message boards.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		getAllBoards()
			.then((boards) => {
				const lines: string[] = [];
				lines.push(color("=== Available Message Boards ===", COLOR.YELLOW));
				lines.push("");

				if (boards.length === 0) {
					lines.push(color("No boards available.", COLOR.SILVER));
				} else {
					for (const board of boards) {
						const typeLabel = board.permanent
							? color("Permanent", COLOR.LIME)
							: color("Time-limited", COLOR.YELLOW);
						const expirationInfo = board.permanent
							? ""
							: ` (expires after ${formatDuration(board.expirationMs || 0)})`;

						lines.push(
							`${color(board.displayName, COLOR.CYAN)} ${color(
								`(${board.name})`,
								COLOR.SILVER
							)}`
						);
						lines.push(`  ${board.description}`);
						lines.push(`  ${typeLabel}${expirationInfo}`);
						lines.push(
							`  ${color("Messages:", COLOR.CYAN)} ${board.messages.length}`
						);
						lines.push("");
					}

					lines.push(
						`Use ${color(
							"board <name>",
							COLOR.CYAN
						)} to read a board, or ${color(
							"board <name> write <message>",
							COLOR.CYAN
						)} to post.`
					);
				}

				actor.sendMessage(
					lines.join(LINEBREAK),
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
			})
			.catch((err) => {
				actor.sendMessage(
					"Error loading boards. Please try again.",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
			});
	},
} satisfies CommandObject;

function formatDuration(ms: number): string {
	const days = Math.floor(ms / (24 * 60 * 60 * 1000));
	const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

	if (days > 0) {
		return `${days} day${days !== 1 ? "s" : ""}`;
	} else if (hours > 0) {
		return `${hours} hour${hours !== 1 ? "s" : ""}`;
	} else {
		const minutes = Math.floor(ms / (60 * 1000));
		return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
	}
}
