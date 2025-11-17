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
import { color, COLOR, SIZER } from "../color.js";
import { string } from "mud-ext";

export default {
	pattern: "who~",
	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor } = context;
		const game = Game.game!;

		const stats = game.getGameStats();
		const players: Array<{
			name: string;
			race: string;
			jobName: string;
			level: number;
		}> = [];

		// Collect all active player names
		game.forEachCharacter((character) => {
			const raceName = character.mob?.race?.name ?? "Unknown";
			const jobName = character.mob?.job?.name ?? "Unknown";
			players.push({
				name: character.credentials.username,
				race: raceName,
				jobName,
				level: character.mob?.level ?? 0,
			});
		});

		// Build the output
		const lines: string[] = [];
		lines.push(color("=== Players Online ===", COLOR.YELLOW));

		const title = `LVL [${string.pad(
			"Race",
			15,
			string.ALIGN.CENTER
		)}] [${string.pad("Job", 15, string.ALIGN.CENTER)}] Name`;
		const bodyLines = [title];
		bodyLines.push(
			...(players.length === 0
				? [color("No players currently online.", COLOR.SILVER)]
				: players.map(({ name, race, jobName, level }) => {
						const _level = color(level.toString().padStart(3, "0"), COLOR.CYAN);
						const _race = color(
							string.pad(race, 15, string.ALIGN.CENTER),
							COLOR.OLIVE
						);
						const _job = color(
							string.pad(jobName, 15, string.ALIGN.CENTER),
							COLOR.TEAL
						);
						const tag = color(`${_level} [${_race}] [${_job}]`, COLOR.GREY);
						return `${tag} ${color(name, COLOR.LIME)}`;
				  }))
		);

		const footerLines = [
			`${color("Total Players:", COLOR.CYAN)} ${color(
				stats.playersOnline.toString(),
				COLOR.WHITE
			)}`,
			`${color("Total Connections:", COLOR.CYAN)} ${color(
				stats.activeConnections.toString(),
				COLOR.WHITE
			)}`,
		];

		const footerBox = string.box({
			input: footerLines,
			width: 76,
			sizer: SIZER,
			style: {
				top: {
					middle: "-",
				},
			},
		});
		const boxed = string.box({
			input: [...bodyLines, ...footerBox],
			width: 80,
			title: "Players Online",
			style: string.BOX_STYLES.ROUNDED,
			sizer: SIZER,
		});

		actor.sendMessage(boxed.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
