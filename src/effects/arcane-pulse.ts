/**
 * Arcane Pulse effect template - A passive job effect for mages.
 *
 * This effect represents mage mastery of arcane energies,
 * providing enhanced magical power and mana.
 *
 * Used by the "mage" job archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "arcane-pulse";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Arcane Pulse",
	description:
		"Mages channel arcane energies, gaining enhanced spell power and mana reserves.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		intelligence: 2,
	},
	secondaryAttributeModifiers: {
		spellPower: 10,
		wisdom: 6,
		resilience: 4,
	},
	resourceCapacityModifiers: {
		maxMana: 800,
	},
	outgoingDamageMultiplier: 1.1,
};


