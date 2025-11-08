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
import { getHelpfile, autocompleteHelpfile } from "../package/help.js";
import { MESSAGE_GROUP } from "../character.js";

/**
 * Format a helpfile for display.
 */
function formatHelpfile(
	context: CommandContext,
	keyword: string,
	content: string,
	aliases?: string[],
	related?: string[]
): void {
	const { actor } = context;
	const lines: string[] = [];

	lines.push(`{Y=== {W${keyword.toUpperCase()}{Y ==={x`);
	lines.push("");
	lines.push(content);

	if (aliases && aliases.length > 0) {
		lines.push("");
		lines.push(`{cAliases:{x ${aliases.join(", ")}`);
	}

	if (related && related.length > 0) {
		lines.push("");
		lines.push(`{cRelated:{x ${related.join(", ")}`);
	}

	lines.push(`{Y${"=".repeat(keyword.length + 10)}{x`);

	actor.sendMessage(lines.join("\n"), MESSAGE_GROUP.COMMAND_RESPONSE);
}

/**
 * Display a list of matching topics.
 */
function displayTopicList(
	context: CommandContext,
	title: string,
	topics: string[]
): void {
	const { actor } = context;
	const lines: string[] = [];

	lines.push(`{Y${title}{x`);
	lines.push("");

	// Display in columns (3 per line)
	const columns = 3;
	for (let i = 0; i < topics.length; i += columns) {
		const row = topics.slice(i, i + columns);
		const formatted = row.map((topic) => topic.padEnd(20)).join("  ");
		lines.push(`  {c${formatted}{x`);
	}

	actor.sendMessage(lines.join("\n"), MESSAGE_GROUP.COMMAND_RESPONSE);
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
				formatHelpfile(
					context,
					commandsHelp.keyword,
					commandsHelp.content,
					commandsHelp.aliases,
					commandsHelp.related
				);
			} else {
				const lines = [
					"{YHelp System{x",
					"",
					"Usage: {chelp <topic>{x",
					"       {chelp search <query>{x",
					"",
					"Type {chelp commands{x for a list of available commands.",
				];
				actor.sendMessage(lines.join("\n"), MESSAGE_GROUP.COMMAND_RESPONSE);
			}
			return;
		}

		// Try exact match first
		const exactMatch = getHelpfile(topic);
		if (exactMatch) {
			formatHelpfile(
				context,
				exactMatch.keyword,
				exactMatch.content,
				exactMatch.aliases,
				exactMatch.related
			);
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
			actor.sendMessage(lines.join("\n"), MESSAGE_GROUP.COMMAND_RESPONSE);
			return;
		}

		if (matches.length === 1) {
			const helpfile = matches[0];
			formatHelpfile(
				context,
				helpfile.keyword,
				helpfile.content,
				helpfile.aliases,
				helpfile.related
			);
			return;
		}

		// Multiple matches - show list
		const topics = matches.map((h) => h.keyword);
		displayTopicList(context, `Multiple topics match "${topic}":`, topics);
		actor.sendLine("");
		actor.sendLine(
			`Type {chelp <topic>{x to view a specific topic, or {chelp search ${topic}{x for details.`
		);
	},

	onError(context: CommandContext, result: ParseResult): void {
		// Handle any parsing errors
		context.actor.sendLine(
			"Usage: {chelp <topic>{x or {chelp search <query>{x"
		);
	},
} satisfies CommandObject;
