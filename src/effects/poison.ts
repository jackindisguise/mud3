/**
 * Poison effect template - A damage over time effect that deals poison damage.
 *
 * This effect deals damage over time and includes act messages for when
 * the poison is applied and when it ticks.
 */

import { DamageOverTimeEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "poison";

export const effectTemplate: DamageOverTimeEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Poison",
	description: "Deals damage over time from poison.",
	type: "damage-over-time",
	stackable: true,
	damage: 10,
	interval: 2, // 2 second interval
	duration: 12, // 12 seconds total (6 ticks)
	isOffensive: true,
	onApply: {
		user: "You feel a toxic poison coursing through your veins!",
		room: "{User} has been poisoned!",
	},
	onTick: {
		user: "You take {damage} poison damage!",
		room: "{User} writhes in pain from the poison.",
	},
};
