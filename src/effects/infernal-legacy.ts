/**
 * Infernal Legacy effect template - A passive racial effect for tieflings.
 *
 * This effect represents tiefling infernal heritage,
 * providing resistance to fire and enhanced magical abilities.
 *
 * Used by the "tiefling" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "infernal-legacy";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Infernal Legacy",
	description:
		"Tieflings bear infernal heritage, granting magical prowess and resistance.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		intelligence: 2,
	},
	secondaryAttributeModifiers: {
		spellPower: 7,
		wisdom: 3,
		resilience: 5,
	},
	resourceCapacityModifiers: {
		maxMana: 500,
	},
};




