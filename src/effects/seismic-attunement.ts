/**
 * Seismic Attunement effect template - A passive job effect for geomancers.
 *
 * This effect represents geomancer attunement to the earth,
 * providing enhanced defensive abilities and earth magic.
 *
 * Used by the "geomancer" job archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "seismic-attunement";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Seismic Attunement",
	description:
		"Geomancers are attuned to the earth, gaining enhanced defense and earth magic.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		strength: 1,
		intelligence: 1,
	},
	secondaryAttributeModifiers: {
		defense: 7,
		vitality: 5,
		spellPower: 8,
		resilience: 6,
	},
	resourceCapacityModifiers: {
		maxHealth: 500,
		maxMana: 600,
	},
};






