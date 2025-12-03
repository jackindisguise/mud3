/**
 * Lunar Regeneration effect template - A passive racial effect for dunpeal.
 *
 * This effect represents the dunpeal's vampiric regeneration,
 * enhanced under the light of the moon.
 *
 * Used by the "dunpeal" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "lunar-regeneration";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Lunar Regeneration",
	description:
		"Dunpeal possess natural regeneration that is enhanced by lunar energy.",
	type: "passive",
	stackable: false,
	healingReceivedMultiplier: 1.15,
	resourceCapacityModifiers: {
		maxHealth: 300,
	},
	secondaryAttributeModifiers: {
		vitality: 2,
	},
};



