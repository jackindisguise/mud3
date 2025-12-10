/**
 * Stalwart Stance effect template - A passive job effect for warriors.
 *
 * This effect represents warrior defensive training and resilience,
 * providing enhanced defense and health.
 *
 * Used by the "warrior" job archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "stalwart-stance";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Stalwart Stance",
	description:
		"Warriors train in defensive techniques, gaining enhanced defense and resilience.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		strength: 1,
	},
	secondaryAttributeModifiers: {
		defense: 8,
		vitality: 5,
	},
	resourceCapacityModifiers: {
		maxHealth: 600,
	},
	incomingDamageMultiplier: 0.94,
};






