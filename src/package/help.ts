/**
 * Package: help - helpfile loader and lookup system
 *
 * Loads helpfiles from `data/help` directory at startup.
 * Each helpfile is a YAML file with:
 * - `keyword: string` - primary keyword for the helpfile
 * - `aliases?: string[]` - optional alternative keywords
 * - `related?: string[]` - optional related topic keywords
 * - `topic?: string[]` - optional topic tags describing the type of information (e.g., "communication", "combat")
 * - `content: string` - the help text (supports multiline with |)
 *
 * Files beginning with `_` are ignored. Only `.yaml` files are loaded.
 * The loader validates related references after all files are loaded.
 *
 * @example
 * // data/help/combat.yaml
 * keyword: combat
 * aliases: [fight, battle]
 * related: [attack, defend, weapons]
 * topic: [combat, fighting, pvp]
 * content: |
 *   Combat in the game involves...
 *
 * @example
 * import helpPkg, { getHelpfile } from './package/help.js';
 * await helpPkg.loader();
 * const help = getHelpfile('combat');
 * if (help) console.log(help.content);
 *
 * @module package/help
 */

import { Package } from "package-loader";
import { readdir, readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { join, extname, relative } from "node:path";
import logger from "../logger.js";

const DATA_DIRECTORY = join(process.cwd(), "data");
const HELP_DIRECTORY = join(DATA_DIRECTORY, "help");

/**
 * Represents a single helpfile entry.
 */
export interface Helpfile {
	/** Primary keyword for this helpfile */
	keyword: string;
	/** Alternative keywords that reference this helpfile */
	aliases?: string[];
	/** Keywords of related helpfiles */
	related?: string[];
	/** Topic tags describing the type of information covered (e.g., "communication", "combat", "magic") */
	topic?: string[];
	/** The help content (supports multiline text) */
	content: string;
}

/**
 * Raw helpfile structure from YAML (before validation)
 */
interface RawHelpfile {
	keyword: string;
	aliases?: string | string[];
	related?: string | string[];
	topic?: string | string[];
	content: string;
}

/**
 * Global registry of loaded helpfiles.
 * Maps keywords (including aliases) to their helpfile entries.
 */
const helpRegistry: Map<string, Helpfile> = new Map();

/**
 * Validates and normalizes a raw helpfile from YAML.
 */
function validateHelpfile(raw: RawHelpfile): Helpfile {
	if (!raw.keyword || typeof raw.keyword !== "string") {
		throw new Error(`Helpfile missing required 'keyword' field`);
	}

	if (!raw.content || typeof raw.content !== "string") {
		throw new Error(`Helpfile missing required 'content' field`);
	}

	// Normalize aliases to array
	let aliases: string[] | undefined;
	if (raw.aliases !== undefined) {
		if (typeof raw.aliases === "string") {
			aliases = [raw.aliases];
		} else if (Array.isArray(raw.aliases)) {
			aliases = raw.aliases.filter((a) => typeof a === "string");
		}
	}

	// Normalize related to array
	let related: string[] | undefined;
	if (raw.related !== undefined) {
		if (typeof raw.related === "string") {
			related = [raw.related];
		} else if (Array.isArray(raw.related)) {
			related = raw.related.filter((r) => typeof r === "string");
		}
	}

	// Normalize topic to array
	let topic: string[] | undefined;
	if (raw.topic !== undefined) {
		if (typeof raw.topic === "string") {
			topic = [raw.topic];
		} else if (Array.isArray(raw.topic)) {
			topic = raw.topic.filter((t) => typeof t === "string");
		}
	}

	// Strip trailing newlines from content (YAML | syntax adds them)
	const content = raw.content.trim();

	return {
		keyword: raw.keyword.toLowerCase(),
		aliases: aliases?.map((a) => a.toLowerCase()),
		related: related?.map((r) => r.toLowerCase()),
		topic: topic?.map((t) => t.toLowerCase()),
		content,
	};
}

/**
 * Load a single helpfile from a YAML file.
 */
async function loadHelpfile(filePath: string): Promise<Helpfile> {
	const content = await readFile(filePath, "utf-8");
	const raw = parseYaml(content) as RawHelpfile;
	return validateHelpfile(raw);
}

/**
 * Register a helpfile in the global registry.
 * Maps both the primary keyword and all aliases to the helpfile.
 */
function registerHelpfile(helpfile: Helpfile): void {
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
 * Verify that all related helpfile references are valid.
 * Logs warnings for any missing references.
 */
function validateRelatedReferences(): void {
	for (const helpfile of helpRegistry.values()) {
		if (!helpfile.related) continue;

		for (const relatedKeyword of helpfile.related) {
			if (!helpRegistry.has(relatedKeyword)) {
				logger.warn(
					`Helpfile "${helpfile.keyword}" references missing related topic: "${relatedKeyword}"`
				);
			}
		}
	}
}

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

export default {
	name: "help",
	loader: async () => {
		logger.info(
			`Loading helpfiles from ${relative(process.cwd(), HELP_DIRECTORY)}`
		);

		let loaded = 0;
		let errors = 0;

		try {
			const files = await readdir(HELP_DIRECTORY);

			for (const file of files) {
				// Skip files starting with underscore
				if (file.startsWith("_")) {
					continue;
				}

				// Only process .yaml files
				if (extname(file).toLowerCase() !== ".yaml") {
					continue;
				}

				const filePath = join(HELP_DIRECTORY, file);

				try {
					const helpfile = await loadHelpfile(filePath);
					registerHelpfile(helpfile);
					loaded++;
				} catch (error) {
					logger.error(
						`Failed to load helpfile ${relative(process.cwd(), filePath)}: ${
							error instanceof Error ? error.message : String(error)
						}`
					);
					errors++;
				}
			}

			// Validate all related references after loading all helpfiles
			validateRelatedReferences();

			logger.info(
				`Loaded ${loaded} helpfile(s)${
					errors > 0 ? ` (${errors} error(s))` : ""
				}`
			);
		} catch (error) {
			logger.warn(
				`Failed to read helpfile directory ${relative(
					process.cwd(),
					HELP_DIRECTORY
				)}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	},
} as Package;
