/**
 * Stone Endurance effect template - Endurance as strong as stone.
 *
 * This passive effect provides enhanced defense and vitality.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "stone-endurance";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Stone Endurance",
	description: "Channel the endurance of stone to bolster your defenses.",
	type: "passive",
	stackable: false,
	secondaryAttributeModifiers: {
		defense: 15,
		vitality: 10,
	},
	resourceCapacityModifiers: {
		maxHealth: 200,
	},
	incomingDamageMultiplier: 0.9,
	onApply: {
		user: "You feel the endurance of stone flow through you!",
		room: "{User} channels the endurance of stone!",
	},
	onExpire: {
		user: "The endurance of stone fades from your body.",
		room: "{User}'s stone endurance fades.",
	},
};
