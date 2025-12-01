/**
 * Adaptable effect template - A passive racial effect for humans.
 *
 * This effect provides bonus attributes to humans, representing their
 * adaptability and versatility.
 *
 * Used by the "human" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "adaptable";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Adaptable",
	description:
		"Humans are adaptable and gain bonus attributes in all categories.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		strength: 1,
		agility: 1,
		intelligence: 1,
	},
	resourceCapacityModifiers: {
		maxHealth: 1000,
	},
};
