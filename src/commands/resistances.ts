/**
 * Resistances command for viewing damage type relationships.
 *
 * Shows resistances, immunities, and vulnerabilities from race and job.
 *
 * @example
 * ```
 * resistances
 * ```
 *
 * **Patterns:**
 * - `resistances` - Show all damage relationships
 * @module commands/resistances
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { LINEBREAK } from "../core/telnet.js";
import { COLOR, color } from "../core/color.js";
import {
	DAMAGE_RELATIONSHIP,
	MARTIAL_DAMAGE_TYPE,
	DAMAGE_TYPE,
	ELEMENTAL_DAMAGE_TYPE,
	ENERGY_DAMAGE_TYPE,
	MISC_DAMAGE_TYPE,
} from "../core/damage-types.js";

/**
 * Format damage type name for display (lowercase with first letter capitalized).
 */
function formatDamageType(type: string): string {
	return type.charAt(0) + type.slice(1).toLowerCase();
}

/**
 * Format relationship name with appropriate color.
 */
function formatRelationship(
	relationship: DAMAGE_RELATIONSHIP | undefined
): string {
	if (!relationship) {
		return color("Normal", COLOR.GREY);
	}

	switch (relationship) {
		case DAMAGE_RELATIONSHIP.RESIST:
			return color("Resist", COLOR.CYAN);
		case DAMAGE_RELATIONSHIP.IMMUNE:
			return color("Immune", COLOR.LIME);
		case DAMAGE_RELATIONSHIP.VULNERABLE:
			return color("Vulnerable", COLOR.CRIMSON);
		default:
			return color("Normal", COLOR.GREY);
	}
}

export const command = {
	pattern: "resistances~",
	aliases: ["resists~", "damage-relationships~"],
	execute(context: CommandContext): void {
		const { actor } = context;
		const relationships = actor.getDamageRelationships();
		const race = actor.race;
		const job = actor.job;

		const lines: string[] = [];
		lines.push(color("=== Damage Relationships ===", COLOR.CYAN));
		lines.push("");

		// Get all damage types
		const allDamageTypes: DAMAGE_TYPE[] = [
			...Object.values(MARTIAL_DAMAGE_TYPE),
			...Object.values(ELEMENTAL_DAMAGE_TYPE),
			...Object.values(ENERGY_DAMAGE_TYPE),
			...Object.values(MISC_DAMAGE_TYPE),
		];

		// Display damage types in 2 columns
		if (allDamageTypes.length > 0) {
			lines.push(color("Damage Types:", COLOR.YELLOW));
			const columnWidth = 30;
			for (let i = 0; i < allDamageTypes.length; i += 2) {
				const type1 = allDamageTypes[i];
				const relationship1 = relationships[type1];
				const typeName1 = formatDamageType(type1);
				const relationshipStr1 = formatRelationship(relationship1);
				const leftCol = `  ${typeName1.padEnd(12)}: ${relationshipStr1}`;

				if (i + 1 < allDamageTypes.length) {
					const type2 = allDamageTypes[i + 1];
					const relationship2 = relationships[type2];
					const typeName2 = formatDamageType(type2);
					const relationshipStr2 = formatRelationship(relationship2);
					const rightCol = `${typeName2.padEnd(12)}: ${relationshipStr2}`;
					lines.push(leftCol.padEnd(columnWidth) + rightCol);
				} else {
					lines.push(leftCol);
				}
			}
			lines.push("");
		}

		// Show sources if available
		const hasRaceRelationships =
			race.damageRelationships &&
			Object.keys(race.damageRelationships).length > 0;
		const hasJobRelationships =
			job.damageRelationships &&
			Object.keys(job.damageRelationships).length > 0;

		if (hasRaceRelationships || hasJobRelationships) {
			lines.push(color("Sources:", COLOR.YELLOW));
			if (hasRaceRelationships) {
				lines.push(
					`  ${color("Race:", COLOR.CYAN)} ${color(race.name, COLOR.WHITE)}`
				);
			}
			if (hasJobRelationships) {
				lines.push(
					`  ${color("Job:", COLOR.CYAN)} ${color(job.name, COLOR.WHITE)}`
				);
			}
			lines.push("");
		}

		// Legend
		lines.push(color("Legend:", COLOR.YELLOW));
		lines.push(
			`  ${formatRelationship(DAMAGE_RELATIONSHIP.RESIST)} - 50% damage`
		);
		lines.push(
			`  ${formatRelationship(DAMAGE_RELATIONSHIP.IMMUNE)} - 0% damage (immune)`
		);
		lines.push(
			`  ${formatRelationship(
				DAMAGE_RELATIONSHIP.VULNERABLE
			)} - 200% damage (double)`
		);
		lines.push(`  ${formatRelationship(undefined)} - 100% damage (normal)`);

		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
