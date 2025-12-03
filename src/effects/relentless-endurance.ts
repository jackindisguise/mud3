/**
 * Relentless Endurance effect template - Endurance that never gives up.
 *
 * This passive effect provides enhanced vitality and health regeneration.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "relentless-endurance";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Relentless Endurance",
	description: "Push beyond your limits with relentless determination.",
	type: "passive",
	stackable: false,
	secondaryAttributeModifiers: {
		vitality: 12,
		endurance: 8,
	},
	resourceCapacityModifiers: {
		maxHealth: 250,
	},
	healingReceivedMultiplier: 1.2,
	onApply: {
		user: "You feel a surge of relentless determination!",
		room: "{User} pushes beyond their limits!",
	},
	onExpire: {
		user: "Your relentless determination begins to wane.",
		room: "{User}'s relentless determination fades.",
	},
};



