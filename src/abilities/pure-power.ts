/**
 * Pure Power ability - A passive ability that increases attack power based on proficiency.
 *
 * This passive ability increases attack power from +0% at 0% proficiency
 * to +200% at 100% proficiency.
 *
 * Proficiency curve:
 * - 25% proficiency at 75 uses
 * - 50% proficiency at 250 uses
 * - 75% proficiency at 500 uses
 * - 100% proficiency at 1000 uses
 *
 * @example
 * ```
 * // Automatically applied when mob knows this ability
 * // At 50% proficiency: +100% attack power (2x damage)
 * // At 100% proficiency: +200% attack power (3x damage)
 * ```
 */

import { Ability } from "../ability.js";

export const ABILITY_ID = "pure-power";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Pure Power",
	description:
		"A passive ability that increases your attack power based on proficiency.",
	proficiencyCurve: [100, 500, 1000, 5000],
};
