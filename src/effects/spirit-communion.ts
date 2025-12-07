/**
 * Spirit Communion effect template - A passive racial effect for soul reapers.
 *
 * This effect represents soul reaper connection to the spiritual realm,
 * enhancing their spiritual power and mana.
 *
 * Used by the "soul-reaper" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "spirit-communion";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Spirit Communion",
	description:
		"Soul reapers commune with the spirit realm, enhancing their spiritual power and mana reserves.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		intelligence: 2,
		agility: 1,
	},
	secondaryAttributeModifiers: {
		spellPower: 7,
		wisdom: 5,
		resilience: 4,
	},
	resourceCapacityModifiers: {
		maxMana: 600,
		maxHealth: 300,
	},
};





