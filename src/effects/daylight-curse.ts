/**
 * Daylight Curse effect template - A passive racial effect for nobility.
 *
 * This effect represents nobility's vulnerability to sunlight,
 * a curse for their vampiric nature.
 *
 * Used by the "nobility" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "daylight-curse";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Daylight Curse",
	description:
		"Nobility suffer from exposure to direct sunlight due to their vampiric nature.",
	type: "passive",
	stackable: false,
	incomingDamageMultiplier: 1.08,
};
