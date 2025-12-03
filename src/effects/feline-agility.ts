/**
 * Feline Agility effect template - The agility of a cat.
 *
 * This passive effect provides enhanced agility and movement speed.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "feline-agility";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Feline Agility",
	description: "Channel the swift agility of a cat to move with incredible speed.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		agility: 3,
	},
	secondaryAttributeModifiers: {
		avoidance: 10,
		accuracy: 8,
		critRate: 5,
	},
	onApply: {
		user: "You feel the swift agility of a cat flow through you!",
		room: "{User} moves with feline grace!",
	},
	onExpire: {
		user: "The feline agility fades from your movements.",
		room: "{User} no longer moves with feline grace.",
	},
};



