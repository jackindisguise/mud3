/**
 * Package: reservedNames - Name blocking system
 *
 * Generates a cache of blocked names from mob templates and updates
 * the reservedNames registry. Used during character creation to prevent
 * players from using names that conflict with game entities or contain
 * inappropriate content.
 *
 * @example
 * import reservedNamesPkg from './package/reservedNames.js';
 * import { isNameBlocked } from '../registry/reservedNames.js';
 * await reservedNamesPkg.loader();
 * if (isNameBlocked("goblin")) {
 *   console.log("Name is blocked");
 * }
 *
 * @module package/reservedNames
 */

import { Package } from "package-loader";
import logger from "../logger.js";
import { DUNGEON_REGISTRY } from "../registry/dungeon.js";
import dungeonPkg from "./dungeon.js";
import { stripColors } from "../color.js";
import {
	addBlockedName,
	clearBlockedNames,
} from "../registry/reserved-names.js";

/**
 * Builds the cache of blocked names from all mob templates.
 * Should be called after dungeons are loaded.
 */
function buildBlockedNamesCache(): void {
	clearBlockedNames();

	let mobTemplateCount = 0;
	let blockedNameCount = 0;

	// Check all dungeons for mob templates
	for (const dungeon of DUNGEON_REGISTRY.values()) {
		for (const template of dungeon.templates.values()) {
			// Only check Mob templates
			if (template.type !== "Mob") continue;

			mobTemplateCount++;

			// Add display name to blocked set (strip colors first)
			if (template.display) {
				const strippedDisplay = stripColors(template.display);
				const normalizedDisplay = strippedDisplay.trim().toLowerCase();
				if (normalizedDisplay.length > 0) {
					addBlockedName(normalizedDisplay);
					blockedNameCount++;
				}
			}

			// Add keywords to blocked set
			if (template.keywords) {
				const keywords = template.keywords
					.toLowerCase()
					.split(/\s+/)
					.filter((k) => k.trim().length > 0);
				for (const keyword of keywords) {
					addBlockedName(keyword);
					blockedNameCount++;
				}
			}
		}
	}

	logger.info(
		`Reserved names cache built: ${mobTemplateCount} mob template(s), ${blockedNameCount} blocked name(s)`
	);
}

export default {
	name: "reservedNames",
	dependencies: [dungeonPkg],
	loader: async () => {
		buildBlockedNamesCache();
	},
} as Package;
