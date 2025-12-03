/**
 * Hidden Step effect template - Step into the shadows.
 *
 * This passive effect provides enhanced avoidance and stealth.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "hidden-step";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Hidden Step",
	description: "Step into the shadows, becoming harder to detect.",
	type: "passive",
	stackable: false,
	secondaryAttributeModifiers: {
		avoidance: 15,
		accuracy: 5,
	},
	onApply: {
		user: "You step into the shadows, becoming harder to detect!",
		room: "{User} steps into the shadows!",
	},
	onExpire: {
		user: "You step out of the shadows, becoming more visible.",
		room: "{User} steps out of the shadows.",
	},
};
