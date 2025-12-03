/**
 * Grave Attunement effect template - A passive job effect for gravesingers.
 *
 * This effect represents gravesinger connection to death and the grave,
 * providing enhanced necromantic power and mana.
 *
 * Used by the "gravesinger" job archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "grave-attunement";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Grave Attunement",
	description:
		"Gravesingers are attuned to death and the grave, gaining enhanced necromantic power.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		intelligence: 2,
	},
	secondaryAttributeModifiers: {
		spellPower: 11,
		wisdom: 7,
		resilience: 5,
	},
	resourceCapacityModifiers: {
		maxMana: 900,
	},
};




