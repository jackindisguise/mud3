/**
 * Earthen Ward effect template - A protective ward of earth.
 *
 * This shield absorbs damage until its absorption capacity is depleted.
 */

import { ShieldEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "earthen-ward";

export const effectTemplate: ShieldEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Earthen Ward",
	description: "A protective ward of earth that absorbs incoming damage.",
	type: "shield",
	stackable: true,
	absorption: 150,
	onApply: {
		user: "You create a protective ward of earth around yourself!",
		room: "{User} creates a protective ward of earth!",
	},
};



