/**
 * Speaker of Beasts effect template - A passive racial effect for firbolg.
 *
 * This effect represents firbolg connection to nature and beasts,
 * enhancing their wisdom and natural magic.
 *
 * Used by the "firbolg" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "speaker-of-beasts";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Speaker of Beasts",
	description:
		"Firbolg share a deep connection with nature and the beasts of the wild.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		intelligence: 2,
	},
	secondaryAttributeModifiers: {
		spellPower: 6,
		wisdom: 4,
		resilience: 3,
	},
	resourceCapacityModifiers: {
		maxMana: 400,
	},
};
