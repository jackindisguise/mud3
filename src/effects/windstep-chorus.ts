/**
 * Windstep Chorus effect template - Move with the chorus of the wind.
 *
 * This passive effect provides enhanced mobility and agility.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "windstep-chorus";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Windstep Chorus",
	description: "Move with the chorus of the wind, enhancing your mobility.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		agility: 2,
	},
	secondaryAttributeModifiers: {
		avoidance: 12,
		accuracy: 10,
	},
	onApply: {
		user: "You feel the wind's chorus guide your movements!",
		room: "{User} moves with the chorus of the wind!",
	},
	onExpire: {
		user: "The wind's chorus fades from your movements.",
		room: "{User} no longer moves with the chorus of the wind.",
	},
};
