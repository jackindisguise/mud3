/**
 * Flying effect template - A passive effect that allows entry into airborne rooms.
 *
 * This effect represents the ability to fly, which is required to enter
 * rooms with the AIRBORNE flag.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "flying";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Flying",
	description:
		"You possess the ability to fly, allowing you to enter airborne rooms.",
	type: "passive",
	stackable: false,
};
