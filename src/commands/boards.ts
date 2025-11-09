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
import { MESSAGE_GROUP, Character } from "../character.js";
import { CommandObject } from "../package/commands.js";
import { getAllBoards } from "../package/board.js";
import { color, COLOR } from "../color.js";
import { LINEBREAK } from "../telnet.js";
import { formatDuration } from "../time.js";

/**
 * Displays a list of all available message boards.
 *
 * @param actor - The actor to send the message to
 */
export function showBoardsList(char: Character): void {
	const actor = char.mob;
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
						`  ${color("Messages:", COLOR.CYAN)} ${board.getMessageCount()}`
					);
					lines.push("");
				}

				lines.push(
					`Use ${color("board <name>", COLOR.CYAN)} to read a board, or ${color(
						"board <name> write",
						COLOR.CYAN
					)} to post.`
				);
			}

			actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
		})
		.catch((err) => {
			actor.sendMessage(
				"Error loading boards. Please try again.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
		});
}

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

		showBoardsList(character);
	},
} satisfies CommandObject;
