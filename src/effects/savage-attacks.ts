/**
 * Savage Attacks effect template - A passive racial effect for half-orcs.
 *
 * This effect represents half-orc ferocity in combat,
 * enhancing their physical damage output.
 *
 * Used by the "half-orc" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "savage-attacks";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Savage Attacks",
	description:
		"Half-orcs fight with relentless ferocity, dealing increased physical damage.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		strength: 2,
	},
	secondaryAttributeModifiers: {
		attackPower: 6,
		critRate: 3,
	},
	outgoingDamageMultiplier: 1.08,
};



