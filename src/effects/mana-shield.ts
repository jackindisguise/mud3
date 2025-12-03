/**
 * Mana Shield effect template - A shield of pure mana.
 *
 * This shield absorbs damage until its absorption capacity is depleted.
 */

import { ShieldEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "mana-shield";

export const effectTemplate: ShieldEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Mana Shield",
	description: "A protective shield of pure mana that absorbs incoming damage.",
	type: "shield",
	stackable: true,
	absorption: 100,
	onApply: {
		user: "You create a shield of pure mana around yourself!",
		room: "{User} creates a shield of pure mana!",
	},
};
