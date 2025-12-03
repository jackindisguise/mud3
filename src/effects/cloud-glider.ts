/**
 * Cloud Glider effect template - A passive racial effect for skypieans.
 *
 * This effect represents skypiean ability to glide and move through the air,
 * enhancing their agility and mobility.
 *
 * Used by the "skypiean" race archetype.
 */

import { PassiveEffectTemplate } from "../core/effect.js";

export const EFFECT_TEMPLATE_ID = "cloud-glider";

export const effectTemplate: PassiveEffectTemplate = {
	id: EFFECT_TEMPLATE_ID,
	name: "Cloud Glider",
	description:
		"Skypieans can glide on air currents, granting enhanced agility and mobility.",
	type: "passive",
	stackable: false,
	primaryAttributeModifiers: {
		agility: 3,
	},
	secondaryAttributeModifiers: {
		avoidance: 9,
		accuracy: 6,
		endurance: 5,
	},
};




