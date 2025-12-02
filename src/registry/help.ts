/**
 * Registry: help - centralized helpfile access
 *
 * Provides a centralized location for accessing registered helpfiles.
 * The registry is populated by the help package.
 *
 * @module registry/help
 */

import logger from "../logger.js";
import { Helpfile } from "../core/help.js";

/**
 * Global registry of loaded helpfiles.
 * Maps keywords (including aliases) to their helpfile entries.
 */
const helpRegistry: Map<string, Helpfile> = new Map();

/**
 * Register a helpfile in the global registry.
 * Maps both the primary keyword and all aliases to the helpfile.
 */
export function registerHelpfile(helpfile: Helpfile): void {
	const keyword = helpfile.keyword.toLowerCase();

	// Check for keyword conflicts
	if (helpRegistry.has(keyword)) {
		const existing = helpRegistry.get(keyword)!;
		logger.warn(
			`Helpfile keyword conflict: "${keyword}" already defined by "${existing.keyword}"`
		);
		return;
	}

	// Register primary keyword
	helpRegistry.set(keyword, helpfile);

	// Register aliases
	if (helpfile.aliases) {
		for (const alias of helpfile.aliases) {
			const aliasLower = alias.toLowerCase();
			if (helpRegistry.has(aliasLower)) {
				const existing = helpRegistry.get(aliasLower)!;
				logger.warn(
					`Helpfile alias conflict: "${aliasLower}" in "${helpfile.keyword}" already defined by "${existing.keyword}"`
				);
				continue;
			}
			helpRegistry.set(aliasLower, helpfile);
		}
	}

	logger.debug(
		`Registered helpfile: ${keyword}${
			helpfile.aliases ? ` (aliases: ${helpfile.aliases.join(", ")})` : ""
		}`
	);
}

/**
 * Get all registered helpfiles.
 *
 * @returns A readonly array of all helpfiles
 */
export const getHelpfiles: () => ReadonlyArray<Helpfile> = () => {
	return Array.from(helpRegistry.values());
};

/**
 * Get all registered helpfiles.
 *
 * @returns A readonly array of all helpfiles
 */
export const getHelpfileRegistry: () => ReadonlyMap<string, Helpfile> = () => {
	return helpRegistry;
};

/**
 * Look up a helpfile by keyword or alias.
 *
 * @param keyword - The keyword or alias to search for (case-insensitive)
 * @returns The helpfile if found, undefined otherwise
 */
export function getHelpfile(keyword: string): Helpfile | undefined {
	return helpRegistry.get(keyword.toLowerCase());
}

/**
 * Autocomplete helpfile keywords and aliases based on a search string.
 *
 * Returns all helpfiles whose keywords or aliases start with the search string.
 * Results are deduplicated (each helpfile appears once even if multiple aliases match)
 * and sorted alphabetically by primary keyword. The search is case-insensitive.
 *
 * @param search - The search string to match against (case-insensitive)
 * @returns Array of matching helpfiles, sorted by primary keyword
 *
 * @example
 * // If helpfiles exist with keywords: "combat", "commands", "cast"
 * // and "combat" has aliases: ["fight", "battle"]
 * autocompleteHelpfile("com") // Returns: [combatHelpfile, commandsHelpfile]
 * autocompleteHelpfile("fi")  // Returns: [combatHelpfile] (matched via "fight" alias)
 * autocompleteHelpfile("")    // Returns: all helpfiles
 */
export function autocompleteHelpfile(search: string): Helpfile[] {
	const searchLower = search.toLowerCase();
	const matchedHelpfiles = new Set<Helpfile>();

	for (const [key, helpfile] of helpRegistry.entries()) {
		if (key.startsWith(searchLower)) {
			matchedHelpfiles.add(helpfile);
		}
	}

	// Sort by primary keyword
	return Array.from(matchedHelpfiles).sort((a, b) =>
		a.keyword.localeCompare(b.keyword)
	);
}

export interface SearchResults {
	bestMatch: Helpfile | undefined;
	keyword: Helpfile[];
	alias: Helpfile[];
	related: Helpfile[];
	topic: Helpfile[];
	content: Helpfile[];
}

/**
 * Deep search for helpfiles across keywords, aliases, content, topics, and related topics.
 *
 * Returns a SearchResults object with helpfiles categorized by match type:
 * - keyword: Helpfiles whose keyword starts with the search term
 * - alias: Helpfiles whose alias starts with the search term
 * - topic: Helpfiles whose topic tag starts with the search term
 * - content: Helpfiles whose content contains the search term (partial match)
 * - related: Helpfiles that have a related topic starting with the search term
 * - bestMatch: The first exact keyword match, or the first keyword match if no exact match
 *
 * Results within each category are sorted alphabetically by primary keyword.
 * The search is case-insensitive.
 *
 * @param search - The search term (case-insensitive)
 * @returns SearchResults object with categorized matches
 *
 * @example
 * const results = searchHelpfiles("att");
 * // results.keyword might contain: [attackHelpfile]
 * // results.topic might contain: [combatHelpfile] (if combat has topic: ["attack"])
 * // results.related might contain: [combatHelpfile] (if combat has related: ["attack"])
 * // results.content might contain: [weaponsHelpfile] (if content mentions "attack")
 */
export function searchHelpfiles(search: string): SearchResults {
	const searchLower = search.toLowerCase();
	const keywordMatches = new Set<Helpfile>();
	const aliasMatches = new Set<Helpfile>();
	const contentMatches = new Set<Helpfile>();
	const relatedMatches = new Set<Helpfile>();
	const topicMatches = new Set<Helpfile>();
	let bestMatch: Helpfile | undefined;

	// Search through all unique helpfiles
	for (const helpfile of new Set(helpRegistry.values())) {
		// Match keyword
		if (helpfile.keyword.startsWith(searchLower)) {
			keywordMatches.add(helpfile);
			// Set best match if exact match or first match
			if (!bestMatch || helpfile.keyword === searchLower) {
				bestMatch = helpfile;
			}
		}

		// Match alias prefix
		if (helpfile.aliases) {
			for (const alias of helpfile.aliases) {
				if (alias.startsWith(searchLower)) {
					aliasMatches.add(helpfile);
					break;
				}
			}
		}

		// Match content (partial match)
		if (helpfile.content.toLowerCase().includes(searchLower)) {
			contentMatches.add(helpfile);
		}

		// Match related helpfile keywords
		if (helpfile.related) {
			for (const relatedKeyword of helpfile.related) {
				if (relatedKeyword.startsWith(searchLower)) {
					relatedMatches.add(helpfile);
					break;
				}
			}
		}

		// Match topic tags
		if (helpfile.topic) {
			for (const topicTag of helpfile.topic) {
				if (topicTag.startsWith(searchLower)) {
					topicMatches.add(helpfile);
					break;
				}
			}
		}
	}

	// Sort function for consistent ordering
	const sortByKeyword = (a: Helpfile, b: Helpfile) =>
		a.keyword.localeCompare(b.keyword);

	return {
		bestMatch:
			bestMatch ||
			(keywordMatches.size > 0
				? Array.from(keywordMatches).sort(sortByKeyword)[0]
				: undefined),
		keyword: Array.from(keywordMatches).sort(sortByKeyword),
		alias: Array.from(aliasMatches).sort(sortByKeyword),
		content: Array.from(contentMatches).sort(sortByKeyword),
		related: Array.from(relatedMatches).sort(sortByKeyword),
		topic: Array.from(topicMatches).sort(sortByKeyword),
	};
}

/**
 * Get all registered helpfile keywords (primary keywords only).
 *
 * @returns Array of all helpfile keywords
 */
export function getAllHelpKeywords(): string[] {
	const keywords = new Set<string>();
	for (const helpfile of helpRegistry.values()) {
		keywords.add(helpfile.keyword);
	}
	return Array.from(keywords).sort();
}

/**
 * Clear all loaded helpfiles.
 * Primarily used for testing.
 */
export function clearHelpfiles(): void {
	helpRegistry.clear();
	logger.debug("Cleared all helpfiles");
}

/**
 * Get the total number of registered helpfiles.
 */
export function getHelpfileCount(): number {
	return new Set(Array.from(helpRegistry.values()).map((h) => h.keyword)).size;
}
