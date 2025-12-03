/**
 * Ossuary Pact effect template - A pact with the dead.
 *
 * This passive effect provides enhanced necrotic power and resilience.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "ossuary-pact";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Ossuary Pact",
	description: "Form a pact with the dead to gain their power.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		intelligence: 4,
	},
	secondaryAttributeModifiers: {
		spellPower: 15,
		resilience: 10,
		wisdom: 8,
	},
	resourceCapacityModifiers: {
		maxMana: 300,
	},
	outgoingDamageMultiplier: 1.1,
	onApply: {
		user: "You form a pact with the dead, gaining their power!",
		room: "{User} forms a pact with the dead!",
	},
	onExpire: {
		user: "Your pact with the dead fades, their power leaving you.",
		room: "{User}'s pact with the dead fades.",
	},
};



