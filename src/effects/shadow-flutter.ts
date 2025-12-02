/**
 * Shadow Flutter effect template - A passive racial effect for kenku.
 *
 * This effect represents kenku agility and ability to move silently,
 * like shadows in the darkness.
 *
 * Used by the "kenku" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "shadow-flutter";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Shadow Flutter",
	description: "Kenku move with silent grace and shadowy swiftness.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		agility: 2,
	},
	secondaryAttributeModifiers: {
		avoidance: 6,
		accuracy: 4,
	},
};

