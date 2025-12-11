/**
 * Mountain Stride effect template - A passive racial effect for goliaths.
 *
 * This effect represents goliath strength and endurance,
 * born from living in high altitudes and harsh terrain.
 *
 * Used by the "goliath" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "mountain-stride";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Mountain Stride",
	description:
		"Goliaths possess immense strength and endurance from mountain living.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		strength: 3,
	},
	secondaryAttributeModifiers: {
		attackPower: 8,
		vitality: 5,
		endurance: 4,
	},
	resourceCapacityModifiers: {
		maxHealth: 600,
	},
};







