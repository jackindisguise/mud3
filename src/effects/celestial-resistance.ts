/**
 * Celestial Resistance effect template - A passive racial effect for aasimar.
 *
 * This effect represents aasimar celestial heritage,
 * providing resistance to dark magic and enhanced healing.
 *
 * Used by the "aasimar" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "celestial-resistance";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Celestial Resistance",
	description:
		"Aasimar possess celestial heritage, granting resistance to dark forces and enhanced healing.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		intelligence: 2,
	},
	secondaryAttributeModifiers: {
		resilience: 7,
		wisdom: 4,
		spellPower: 5,
	},
	healingReceivedMultiplier: 1.12,
	resourceCapacityModifiers: {
		maxMana: 450,
	},
};







