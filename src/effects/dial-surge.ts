/**
 * Dial Surge effect template - A surge of dial power.
 *
 * This passive effect provides enhanced attributes and damage output.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "dial-surge";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Dial Surge",
	description: "Release a surge of dial power to enhance your abilities.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		strength: 3,
		agility: 3,
		intelligence: 3,
	},
	secondaryAttributeModifiers: {
		attackPower: 10,
		spellPower: 10,
		critRate: 8,
	},
	outgoingDamageMultiplier: 1.15,
	onApply: {
		user: "You feel a surge of dial power coursing through you!",
		room: "{User} releases a surge of dial power!",
	},
	onExpire: {
		user: "The surge of dial power fades from your body.",
		room: "{User}'s dial power surge fades.",
	},
};
