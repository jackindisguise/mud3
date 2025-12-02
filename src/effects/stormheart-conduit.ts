/**
 * Stormheart Conduit effect template - A passive job effect for stormcallers.
 *
 * This effect represents stormcaller attunement to storms and lightning,
 * providing enhanced electrical magic and agility.
 *
 * Used by the "stormcaller" job archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "stormheart-conduit";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Stormheart Conduit",
	description:
		"Stormcallers channel the power of storms, gaining enhanced electrical magic and swift movement.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		intelligence: 2,
		agility: 1,
	},
	secondaryAttributeModifiers: {
		spellPower: 9,
		wisdom: 5,
		avoidance: 4,
	},
	resourceCapacityModifiers: {
		maxMana: 750,
	},
};


