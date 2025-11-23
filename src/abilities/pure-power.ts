/**
 * Pure Power ability - A passive ability that increases attack power based on proficiency.
 *
 * This passive ability increases attack power from +0% at 0% proficiency
 * to +200% at 100% proficiency.
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
};
