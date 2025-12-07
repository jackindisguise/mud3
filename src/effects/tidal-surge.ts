/**
 * Tidal Surge effect template - A passive racial effect for fishmen.
 *
 * This effect represents fishman strength and power near water,
 * providing enhanced physical might.
 *
 * Used by the "fishman" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "tidal-surge";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Tidal Surge",
	description:
		"Fishmen draw strength from the ocean, granting enhanced physical power and endurance.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		strength: 3,
	},
	secondaryAttributeModifiers: {
		attackPower: 9,
		vitality: 6,
		endurance: 5,
	},
	resourceCapacityModifiers: {
		maxHealth: 700,
	},
};





