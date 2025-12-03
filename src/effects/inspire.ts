/**
 * Inspire effect template - Inspire your allies.
 *
 * This passive effect provides enhanced attributes to nearby allies.
 * Note: This is a self-buff for now, but could be extended to affect allies.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "inspire";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Inspire",
	description: "Inspire your allies with your presence and leadership.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		strength: 2,
		agility: 2,
		intelligence: 2,
	},
	secondaryAttributeModifiers: {
		attackPower: 8,
		spellPower: 8,
	},
	onApply: {
		user: "You feel inspired and ready for battle!",
		room: "{User} inspires those around them!",
	},
	onExpire: {
		user: "Your inspiring presence begins to fade.",
		room: "{User}'s inspiring presence fades.",
	},
};
