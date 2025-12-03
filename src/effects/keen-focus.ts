/**
 * Keen Focus effect template - A passive racial effect for elves.
 *
 * This effect enhances elven mental acuity and magical prowess,
 * representing their attunement to the arcane.
 *
 * Used by the "elf" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "keen-focus";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Keen Focus",
	description:
		"Elves possess sharp mental acuity and enhanced magical abilities.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		intelligence: 2,
	},
	secondaryAttributeModifiers: {
		spellPower: 5,
		wisdom: 3,
	},
};



