/**
 * Help command for accessing game documentation.
 *
 * Displays helpfile content for a given topic. Supports exact keyword/alias
 * matching as well as autocomplete prefix matching. If multiple helpfiles match
 * the search term, displays a list of matching topics.
 *
 * The "help search" variant performs a deep search across keywords, aliases,
 * content, and related topics, showing categorized results.
 *
 * @example
 * ```
 * help            // shows general help or command list
 * help combat     // shows combat helpfile
 * help com        // autocompletes to first matching topic
 * help search att // deep search for "att" across all fields
 * ```
 *
 * **Aliases:** `?`
 * **Pattern:** `help~ <topic:word?>`
 * **Search Pattern:** `help~ search <query:text>`
 * @module commands/help
 */

import { CommandContext, ParseResult } from "../command.js";
import { CommandObject } from "../package/commands.js";
import {
	getHelpfile,
	autocompleteHelpfile,
	Helpfile,
} from "../package/help.js";
import { MESSAGE_GROUP } from "../character.js";
import { Mob } from "../dungeon.js";
import { LINEBREAK } from "../telnet.js";
import { SIZER, color, COLOR } from "../color.js";
import { string } from "mud-ext";

/**
 * Format a helpfile for display.
 */
function displayHelpfile(actor: Mob, helpfile: Helpfile): void {
	const lines: string[] = [];
	lines.push(...helpfile.content.split("\n"));

	const meta = [];
	if (helpfile.aliases && helpfile.aliases.length > 0)
		meta.push(
			`${color("Aliases", COLOR.TEAL)}: ${color(
				helpfile.aliases.join(", "),
				COLOR.CYAN
			)}`
		);

	if (helpfile.related && helpfile.related.length > 0)
		meta.push(
			`${color("Related", COLOR.TEAL)}: ${color(
				helpfile.related.join(", "),
				COLOR.CYAN
			)}`
		);

	if (meta.length) {
		const metaBox = string.box({
			input: meta,
			width: 76,
			style: {
				top: {
					middle: "-",
					left: ">",
					right: "<",
				},
			},
			title: `See...`,
			sizer: SIZER,
		});
		lines.push("", ...metaBox);
	}

	const box = string.box({
		input: lines,
		width: 80,
		color: (str) => color(str, COLOR.YELLOW),
		style: {
			...string.BOX_STYLES.ROUNDED,
			titleHAlign: string.ALIGN.CENTER,
			titleBorder: {
				left: ">",
				right: "<",
			},
		},
		title: `${helpfile.keyword.toUpperCase()}`,
		sizer: SIZER,
	});
	actor.sendMessage(box.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
}

export default {
	pattern: "help~ <topic:word?>",
	aliases: ["? <topic:word?>"],
	execute(context: CommandContext, args: Map<string, any>): void {
		const topic = args.get("topic") as string | undefined;
		const { actor } = context;

		// No topic provided - show general help or command list
		if (!topic) {
			const commandsHelp = getHelpfile("commands");
			if (commandsHelp) {
				displayHelpfile(actor, commandsHelp);
			} else {
				const lines = [
					"{YHelp System{x",
					"",
					"Usage: {chelp <keyword>{x",
					"       {chelp search <query>{x",
					"",
					"Type {chelp commands{x for a list of available commands.",
				];
				actor.sendMessage(
					lines.join(LINEBREAK),
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
			}
			return;
		}

		// Try exact match first
		const exactMatch = getHelpfile(topic);
		if (exactMatch) {
			displayHelpfile(actor, exactMatch);
			return;
		}

		// Try autocomplete (prefix matching)
		const matches = autocompleteHelpfile(topic);

		if (matches.length === 0) {
			const lines = [
				`{RNo help found for "{W${topic}{R".{x`,
				"",
				`Try {chelp search ${topic}{x for a broader search.`,
			];
			actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
			return;
		}

		if (matches.length === 1) {
			const helpfile = matches[0];
			displayHelpfile(actor, helpfile);
			return;
		}

		// Multiple matches - show list
		const keywords = matches.map((h) => h.keyword);
		const lines: string[] = [];

		lines.push(`{YMultiple helpfiles match "${topic}":{x`);
		lines.push("");

		// Display in columns (3 per line)
		const columns = 3;
		for (let i = 0; i < keywords.length; i += columns) {
			const row = keywords.slice(i, i + columns);
			const formatted = row.map((keyword) => keyword.padEnd(20)).join("  ");
			lines.push(`  {c${formatted}{x`);
		}

		lines.push("");
		lines.push(
			`Type {chelp <keyword>{x to view a specific file, or {chelp search ${topic}{x for details.`
		);

		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},

	onError(context: CommandContext, result: ParseResult): void {
		context.actor.sendMessage(
			"Usage: {chelp <keyword>{x or {chelp search <query>{x",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	},
} satisfies CommandObject;
