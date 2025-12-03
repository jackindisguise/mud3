/**
 * Second Attack ability - A passive ability that grants an extra attack with your main hand weapon.
 *
 * This passive ability automatically triggers an additional attack with your main hand weapon
 * during each combat round. It has no associated command and procs automatically.
 *
 * Proficiency curve:
 * - 25% proficiency at 100 uses
 * - 50% proficiency at 500 uses
 * - 75% proficiency at 1000 uses
 * - 100% proficiency at 5000 uses
 *
 * @example
 * ```
 * // Automatically procs during combat rounds
 * // Grants one extra attack with main hand weapon
 * ```
 */

import { Ability } from "../core/ability.js";

export const ABILITY_ID = "second-attack";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Second Attack",
	description:
		"A passive ability that grants an extra attack with your main hand weapon during combat rounds.",
	proficiencyCurve: [100, 500, 1000, 5000],
};
