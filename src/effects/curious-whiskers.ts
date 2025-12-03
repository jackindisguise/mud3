/**
 * Curious Whiskers effect template - A passive racial effect for tabaxi.
 *
 * This effect represents tabaxi agility and curiosity,
 * enhancing their mobility and quickness.
 *
 * Used by the "tabaxi" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "curious-whiskers";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Curious Whiskers",
	description:
		"Tabaxi are naturally agile and quick, with enhanced mobility and reflexes.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		agility: 3,
	},
	secondaryAttributeModifiers: {
		avoidance: 8,
		accuracy: 5,
		endurance: 4,
	},
};




