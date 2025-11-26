/**
 * Help search command for deep searching across all helpfiles.
 *
 * Performs a comprehensive search across helpfile keywords, aliases, content,
 * and related topics. Results are categorized by match type to help users find
 * the most relevant topics.
 *
 * @example
 * ```
 * help search combat // (search for "combat" everywhere)
 * help search attack // (find all mentions of "attack")
 * help search comm   // (partial search)
 * ```
 *
 * **Aliases:** `? search <query:text>`
 * **Pattern:** `help~ search <query:text>`
 * @module commands/help-search
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { CommandObject } from "../package/commands.js";
import { searchHelpfiles } from "../registry/help.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { LINEBREAK } from "../core/telnet.js";

/**
 * Display search results categorized by match type.
 */
function displaySearchResults(
	context: CommandContext,
	query: string,
	results: ReturnType<typeof searchHelpfiles>
): void {
	const { actor } = context;
	const lines: string[] = [];

	const totalMatches =
		results.keyword.length +
		results.alias.length +
		results.content.length +
		results.related.length +
		results.topic.length;

	if (totalMatches === 0) {
		lines.push(`{RNo results found for "{W${query}{R".{x`);
		lines.push("");
		lines.push(
			"Try a different search term or {chelp commands{x for a full list."
		);
		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
		return;
	}

	lines.push(`{YSearch Results for "{W${query}{Y":{x`);
	lines.push("");

	// Show best match prominently if available
	if (results.bestMatch) {
		lines.push(`{GBest Match:{x {c${results.bestMatch.keyword}{x`);
		lines.push(`  ${results.bestMatch.content.split("\n")[0]}...`);
		lines.push("");
	}

	// Display keyword matches
	if (results.keyword.length > 0) {
		lines.push(`{gKeyword Matches ({W${results.keyword.length}{g):{x`);
		for (const helpfile of results.keyword) {
			lines.push(`  {c${helpfile.keyword}{x`);
		}
		lines.push("");
	}

	// Display alias matches
	if (results.alias.length > 0) {
		lines.push(`{gAlias Matches ({W${results.alias.length}{g):{x`);
		for (const helpfile of results.alias) {
			const matchingAliases = helpfile.aliases?.filter((a) =>
				a.toLowerCase().startsWith(query.toLowerCase())
			);
			lines.push(
				`  {c${helpfile.keyword}{x (via: ${matchingAliases?.join(", ")})`
			);
		}
		lines.push("");
	}

	// Display topic matches
	if (results.topic.length > 0) {
		lines.push(`{gTopic Matches ({W${results.topic.length}{g):{x`);
		for (const helpfile of results.topic) {
			const matchingTopics = helpfile.topic?.filter((t) =>
				t.toLowerCase().startsWith(query.toLowerCase())
			);
			lines.push(
				`  {c${helpfile.keyword}{x (topic: ${matchingTopics?.join(", ")})`
			);
		}
		lines.push("");
	}

	// Display content matches
	if (results.content.length > 0) {
		lines.push(`{gContent Matches ({W${results.content.length}{g):{x`);
		for (const helpfile of results.content) {
			// Find and display a snippet of the matching content
			const contentLower = helpfile.content.toLowerCase();
			const queryLower = query.toLowerCase();
			const matchIndex = contentLower.indexOf(queryLower);

			if (matchIndex !== -1) {
				// Extract ~50 chars before and after the match
				const start = Math.max(0, matchIndex - 30);
				const end = Math.min(
					helpfile.content.length,
					matchIndex + query.length + 30
				);
				let snippet = helpfile.content.substring(start, end);

				// Add ellipses if truncated
				if (start > 0) snippet = "..." + snippet;
				if (end < helpfile.content.length) snippet = snippet + "...";

				// Clean up newlines in snippet
				snippet = snippet.replace(/\n/g, " ").replace(/\s+/g, " ");

				// Highlight the matched text in the snippet
				const snippetLower = snippet.toLowerCase();
				const matchPos = snippetLower.indexOf(queryLower);
				if (matchPos !== -1) {
					const before = snippet.substring(0, matchPos);
					const match = snippet.substring(matchPos, matchPos + query.length);
					const after = snippet.substring(matchPos + query.length);
					snippet = `${before}{Y${match}{x${after}`;
				}

				// Build the line with keyword prefix
				const prefix = `  {c${helpfile.keyword}{x: `;
				const line = prefix + snippet;

				// Enforce 80 character limit (accounting for color codes being invisible)
				// Color codes like {c, {x, {W, etc. don't count toward visible length
				const visiblePrefix = `  ${helpfile.keyword}: `;
				const maxSnippetLength = 80 - visiblePrefix.length;

				if (snippet.length > maxSnippetLength) {
					// Truncate snippet and add ellipsis
					const truncated = snippet.substring(0, maxSnippetLength - 3) + "...";
					lines.push(`  {c${helpfile.keyword}{x: ${truncated}`);
				} else {
					lines.push(line);
				}
			} else {
				lines.push(`  {c${helpfile.keyword}{x`);
			}
		}
		lines.push("");
	}

	// Display related matches
	if (results.related.length > 0) {
		lines.push(`{gRelated Topic Matches ({W${results.related.length}{g):{x`);
		for (const helpfile of results.related) {
			const matchingRelated = helpfile.related?.filter((r) =>
				r.toLowerCase().startsWith(query.toLowerCase())
			);
			lines.push(
				`  {c${helpfile.keyword}{x (related: ${matchingRelated?.join(", ")})`
			);
		}
		lines.push("");
	}

	lines.push(`{YTotal: {W${totalMatches}{Y result(s){x`);
	lines.push("");
	lines.push("Type {chelp <topic>{x to view a specific topic.");

	actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
}

export default {
	pattern: "help~ search <query:text>",
	aliases: ["? search <query:text>"],
	execute(context: CommandContext, args: Map<string, any>): void {
		const query = args.get("query") as string;
		const results = searchHelpfiles(query);
		displaySearchResults(context, query, results);
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error === "Missing required argument: query") {
			const lines = [
				"Usage: {chelp search <query>{x",
				"Example: {chelp search combat{x",
			];
			context.actor.sendMessage(
				lines.join(LINEBREAK),
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
