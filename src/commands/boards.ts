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
import { getBoards, loadBoards } from "../package/board.js";
import { color, COLOR, SIZER } from "../color.js";
import { LINEBREAK } from "../telnet.js";
import { formatDuration } from "../time.js";
import { Board } from "../board.js";
import { string } from "mud-ext";

/**
 * Displays a list of all available message boards.
 *
 * @param actor - The actor to send the message to
 */
export function showBoardsList(char: Character): void {
	const actor = char.mob!;
	const render = (boards: Board[]) => {
		const lines: string[] = [];
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

		const box = string.box({
			input: lines,
			width: 80,
			sizer: SIZER,
			style: {
				...string.BOX_STYLES.PLAIN,
				titleHAlign: string.ALIGN.CENTER,
			},
			title: color("Message Boards", COLOR.YELLOW),
		});
		actor.sendMessage(box.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	};

	const cachedBoards = getBoards();
	if (cachedBoards.length > 0) {
		render(cachedBoards);
		return;
	}
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
