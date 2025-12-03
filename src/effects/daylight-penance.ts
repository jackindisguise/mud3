/**
 * Daylight Penance effect template - A passive racial effect for dunpeal.
 *
 * This effect represents the dunpeal's vulnerability to sunlight,
 * a penalty for their vampiric nature.
 *
 * Used by the "dunpeal" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "daylight-penance";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Daylight Penance",
	description:
		"Dunpeal suffer from exposure to direct sunlight due to their vampiric nature.",
	type: "passive",
	stackable: false,
	incomingDamageMultiplier: 1.05,
};



