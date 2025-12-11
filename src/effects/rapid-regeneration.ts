/**
 * Rapid Regeneration effect template - A passive racial effect for oni.
 *
 * This effect represents oni demonic regeneration abilities,
 * allowing them to heal quickly from wounds.
 *
 * Used by the "oni" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "rapid-regeneration";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Rapid Regeneration",
	description:
		"Oni possess demonic regeneration that allows them to recover from wounds rapidly.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		strength: 2,
	},
	secondaryAttributeModifiers: {
		vitality: 6,
		defense: 5,
	},
	healingReceivedMultiplier: 1.2,
	resourceCapacityModifiers: {
		maxHealth: 1000,
	},
};







