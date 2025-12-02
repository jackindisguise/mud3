/**
 * Sulong Awakening effect template - A passive racial effect for mink.
 *
 * This effect represents mink electro-charged nature,
 * providing enhanced agility and electrical power.
 *
 * Used by the "mink" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "sulong-awakening";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Sulong Awakening",
	description:
		"Mink possess electro-charged fur that grants enhanced agility and electrical power.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		agility: 3,
	},
	secondaryAttributeModifiers: {
		avoidance: 8,
		accuracy: 7,
		spellPower: 5,
	},
	resourceCapacityModifiers: {
		maxMana: 500,
	},
};


