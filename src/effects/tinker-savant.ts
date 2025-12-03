/**
 * Tinker Savant effect template - A passive racial effect for gnomes.
 *
 * This effect represents gnome ingenuity and technical mastery,
 * enhancing their intelligence and magical tinkering abilities.
 *
 * Used by the "gnome" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "tinker-savant";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Tinker Savant",
	description:
		"Gnomes are master tinkerers with exceptional intelligence and magical aptitude.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		intelligence: 3,
	},
	secondaryAttributeModifiers: {
		spellPower: 6,
		wisdom: 5,
		resilience: 4,
	},
	resourceCapacityModifiers: {
		maxMana: 450,
	},
};




