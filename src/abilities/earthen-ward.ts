/**
 * Earthen Ward ability - A protective ward of earth.
 *
 * @example
 * ```
 * earthen ward
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { effectTemplate } from "../effects/earthen-ward.js";

export const ABILITY_ID = "earthen-ward";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Earthen Ward",
	description: "Create a protective ward of earth around yourself.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 8000;

export const command: CommandObject = {
	pattern: "earthen ward~",
	cooldown(context: CommandContext, args: Map<string, any>) {
		const { actor, room } = context;
		if (!actor.knowsAbilityById(ABILITY_ID)) {
			return 0;
		}
		if (!room) {
			return 0;
		}
		return COOLDOWN_MS;
	},

	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor, room } = context;

		if (!room) {
			actor.sendMessage(
				"You are not in a room.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const proficiencyPercent = actor.learnedAbilities.get(ability.id) ?? 0;
		const scaledAbsorption = Math.floor(
			effectTemplate.absorption * (1 + proficiencyPercent / 100)
		);

		actor.addEffect({ ...effectTemplate, absorption: scaledAbsorption }, actor);

		actor.useAbility(ability, 1);
	},
};
