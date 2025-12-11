/**
 * Dimensional Slip effect template - A passive job effect for riftstalkers.
 *
 * This effect represents riftstalker ability to phase between dimensions,
 * providing enhanced mobility and avoidance.
 *
 * Used by the "riftstalker" job archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "dimensional-slip";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Dimensional Slip",
	description:
		"Riftstalkers can slip between dimensions, gaining enhanced mobility and avoidance.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		agility: 2,
	},
	secondaryAttributeModifiers: {
		avoidance: 10,
		accuracy: 7,
		endurance: 5,
	},
	incomingDamageMultiplier: 0.92,
};







