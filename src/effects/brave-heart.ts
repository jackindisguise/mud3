/**
 * Brave Heart effect template - A passive racial effect for halflings.
 *
 * This effect represents halfling courage and luck,
 * helping them avoid danger and resist fear.
 *
 * Used by the "halfling" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "brave-heart";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Brave Heart",
	description:
		"Halflings possess remarkable courage and luck that helps them avoid harm.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		agility: 2,
	},
	secondaryAttributeModifiers: {
		avoidance: 7,
		accuracy: 5,
	},
	incomingDamageMultiplier: 0.97,
};


