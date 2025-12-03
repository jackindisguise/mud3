/**
 * Mournful Wail effect template - A wail that brings sorrow.
 *
 * This passive effect weakens enemies by reducing their attributes.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "mournful-wail";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Mournful Wail",
	description: "Emit a mournful wail that weakens your enemies.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		strength: -2,
		agility: -2,
		intelligence: -2,
	},
	secondaryAttributeModifiers: {
		attackPower: -10,
		spellPower: -10,
	},
	outgoingDamageMultiplier: 0.85,
	isOffensive: true,
	onApply: {
		user: "You feel weakened by the mournful wail!",
		room: "{User} is weakened by a mournful wail!",
	},
	onExpire: {
		user: "The mournful wail's effect fades, and you feel your strength returning.",
		room: "{User} recovers from the mournful wail's effect.",
	},
};
