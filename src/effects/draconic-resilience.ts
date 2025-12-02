/**
 * Draconic Resilience effect template - A passive racial effect for dragonborn.
 *
 * This effect represents dragonborn natural toughness from their draconic ancestry,
 * providing enhanced defense and vitality.
 *
 * Used by the "dragonborn" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "draconic-resilience";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Draconic Resilience",
	description:
		"Dragonborn inherit natural toughness and resilience from their draconic ancestry.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		strength: 2,
	},
	secondaryAttributeModifiers: {
		defense: 6,
		vitality: 4,
		resilience: 5,
	},
	resourceCapacityModifiers: {
		maxHealth: 400,
	},
};


