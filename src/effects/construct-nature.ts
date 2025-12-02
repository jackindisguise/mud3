/**
 * Construct Nature effect template - A passive racial effect for warforged.
 *
 * This effect represents the warforged's mechanical nature,
 * providing resilience and durability.
 *
 * Used by the "warforged" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "construct-nature";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Construct Nature",
	description:
		"Warforged are living constructs with enhanced durability and resistance.",
	type: "passive",
	stackable: false,
	secondaryAttributeModifiers: {
		defense: 7,
		vitality: 4,
		resilience: 3,
	},
	resourceCapacityModifiers: {
		maxHealth: 800,
	},
	incomingDamageMultiplier: 0.95,
};


