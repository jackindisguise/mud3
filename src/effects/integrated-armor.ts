/**
 * Integrated Armor effect template - Armor integrated into your body.
 *
 * This shield absorbs physical damage until its absorption capacity is depleted.
 */

import { ShieldEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "integrated-armor";

export const effectTemplate: ShieldEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Integrated Armor",
	description: "Armor integrated into your body that absorbs incoming damage.",
	type: "shield",
	stackable: false,
	absorption: 200,
	onApply: {
		user: "You activate your integrated armor!",
		room: "{User} activates their integrated armor!",
	},
};
