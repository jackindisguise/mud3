/**
 * Starlight Immortality effect template - A passive racial effect for nobility.
 *
 * This effect represents nobility's ancient vampiric power,
 * providing enhanced attributes and durability.
 *
 * Used by the "nobility" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "starlight-immortality";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Starlight Immortality",
	description:
		"Nobility possess ancient vampiric power that grants enhanced attributes and near-immortal durability.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		strength: 2,
		intelligence: 2,
		agility: 1,
	},
	secondaryAttributeModifiers: {
		attackPower: 7,
		spellPower: 7,
		vitality: 6,
		resilience: 6,
	},
	resourceCapacityModifiers: {
		maxHealth: 800,
		maxMana: 700,
	},
	healingReceivedMultiplier: 1.15,
};


