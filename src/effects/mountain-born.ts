/**
 * Mountain Born effect template - A passive racial effect for dwarves.
 *
 * This effect represents dwarven toughness and resilience,
 * born from living in harsh mountain environments.
 *
 * Used by the "dwarf" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "mountain-born";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Mountain Born",
	description:
		"Dwarves are hardy and resilient, with natural toughness from mountain living.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		strength: 2,
	},
	secondaryAttributeModifiers: {
		defense: 5,
		vitality: 3,
	},
	resourceCapacityModifiers: {
		maxHealth: 500,
	},
};




