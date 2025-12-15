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
import YAML from "js-yaml";
import { join, extname, relative } from "node:path";
import logger from "../utils/logger.js";
import { getSafeRootDirectory } from "../utils/path.js";
import { Helpfile, SerializedHelpfile } from "../core/help.js";
import { getHelpfileRegistry, registerHelpfile } from "../registry/help.js";

const ROOT_DIRECTORY = getSafeRootDirectory();
const DATA_DIRECTORY = join(ROOT_DIRECTORY, "data");
const HELP_DIRECTORY = join(DATA_DIRECTORY, "help");

/**
 * Validates and normalizes a raw helpfile from YAML.
 */
function validateHelpfile(raw: SerializedHelpfile): Helpfile {
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
	const raw = YAML.load(content);

	if (!raw || typeof raw !== "object") {
		throw new Error(`Invalid helpfile format in ${filePath}`);
	}

	return validateHelpfile(raw as SerializedHelpfile);
}

/**
 * Verify that all related helpfile references are valid.
 * Logs warnings for any missing references.
 */
function validateRelatedReferences(): void {
	const registry = getHelpfileRegistry();
	for (const helpfile of registry.values()) {
		if (!helpfile.related) continue;

		for (const relatedKeyword of helpfile.related) {
			if (!registry.has(relatedKeyword)) {
				logger.warn(
					`Helpfile "${helpfile.keyword}" references missing related topic: "${relatedKeyword}"`
				);
			}
		}
	}
}

export default {
	name: "help",
	loader: async () => {
		logger.debug(
			`Loading helpfiles from ${relative(ROOT_DIRECTORY, HELP_DIRECTORY)}`
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
						`Failed to load helpfile ${relative(ROOT_DIRECTORY, filePath)}: ${
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
					ROOT_DIRECTORY,
					HELP_DIRECTORY
				)}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	},
} as Package;
