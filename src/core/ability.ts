/**
 * Core ability module.
 *
 * Provides the Ability interface and utility functions for managing ability proficiency.
 * Abilities are skills that mobs can learn and use in the game.
 *
 * @module core/ability
 */

/**
 * Ability interface representing skills that mobs can learn.
 * Abilities are things that mobs can learn and use in the game.
 *
 * @property id - Unique identifier for the ability
 * @property name - Display name of the ability
 * @property description - Description of what the ability does
 * @property proficiencyCurve - Array of 4 breakpoints [25%, 50%, 75%, 100%] representing uses needed (required)
 * @property proficiencyTable - Pre-generated table mapping uses to proficiency (generated at runtime, do not supply)
 *
 * @example
 * ```typescript
 * const whirlwind: Ability = {
 *   id: "whirlwind",
 *   name: "Whirlwind",
 *   description: "A spinning attack that hits all nearby enemies.",
 *   proficiencyCurve: [75, 250, 500, 1000]
 * };
 * // proficiencyTable is automatically generated at runtime
 * ```
 */
export interface Ability {
	id: string;
	name: string;
	description: string;
	proficiencyCurve: [number, number, number, number];
	proficiencyTable?: Record<number, number>;
}

/**
 * Generates a proficiency table for an ability based on its proficiency curve.
 * The table maps uses (0 to maxUses) to proficiency values (0 to 100).
 * Uses linear interpolation between breakpoints.
 *
 * @param ability - The ability with proficiencyCurve defined
 * @returns A record mapping uses to proficiency values
 *
 * @example
 * ```typescript
 * const ability: Ability = {
 *   id: "test",
 *   name: "Test",
 *   description: "Test ability",
 *   proficiencyCurve: [75, 250, 500, 1000]
 * };
 * const table = generateProficiencyTable(ability);
 * console.log(table[75]); // 25
 * console.log(table[250]); // 50
 * console.log(table[1000]); // 100
 * ```
 */
export function generateProficiencyTable(
	ability: Ability
): Record<number, number> {
	const [uses25, uses50, uses75, uses100] = ability.proficiencyCurve;
	const table: Record<number, number> = {};

	// Generate table from 0 to max uses (100% breakpoint)
	for (let uses = 0; uses <= uses100; uses++) {
		let proficiency: number;

		if (uses === 0) {
			proficiency = 0;
		} else if (uses <= uses25) {
			// Linear interpolation from 0 to 25%
			proficiency = (uses / uses25) * 25;
		} else if (uses <= uses50) {
			// Linear interpolation from 25% to 50%
			proficiency = 25 + ((uses - uses25) / (uses50 - uses25)) * 25;
		} else if (uses <= uses75) {
			// Linear interpolation from 50% to 75%
			proficiency = 50 + ((uses - uses50) / (uses75 - uses50)) * 25;
		} else {
			// Linear interpolation from 75% to 100%
			proficiency = 75 + ((uses - uses75) / (uses100 - uses75)) * 25;
		}

		// Round to nearest integer and clamp to 0-100
		table[uses] = Math.max(0, Math.min(100, Math.round(proficiency)));
	}

	return table;
}

/**
 * Gets the proficiency at a specific number of uses for an ability.
 * If uses exceeds the 100% breakpoint, returns 100.
 *
 * @param ability - The ability with proficiencyTable defined
 * @param uses - The number of times the ability has been used
 * @returns Proficiency value from 0 to 100
 *
 * @example
 * ```typescript
 * const ability: Ability = {
 *   id: "test",
 *   name: "Test",
 *   description: "Test ability",
 *   proficiencyCurve: [75, 250, 500, 1000],
 *   proficiencyTable: generateProficiencyTable(ability)
 * };
 * console.log(getProficiencyAtUses(ability, 75)); // 25
 * console.log(getProficiencyAtUses(ability, 500)); // 75
 * console.log(getProficiencyAtUses(ability, 2000)); // 100 (exceeds max)
 * ```
 */
export function getProficiencyAtUses(ability: Ability, uses: number): number {
	if (!ability.proficiencyTable) {
		// If no table defined, return 0%
		return 0;
	}

	// If uses exceeds the max (100% breakpoint), return 100%
	const maxUses = ability.proficiencyCurve[3];
	if (uses > maxUses) {
		return 100;
	}

	// Look up in table - should always be defined since table is generated for all values 0 to maxUses
	const table = ability.proficiencyTable;
	return table[uses] ?? 0;
}
