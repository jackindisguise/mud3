/**
 * Zanpakuto Release ability - Release the true power of your zanpakuto.
 *
 * @example
 * ```
 * zanpakuto release
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { act } from "../act.js";

export const ABILITY_ID = "zanpakuto-release";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Zanpakuto Release",
	description:
		"Release the true power of your zanpakuto, unlocking its full potential.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 60000;

export const command: CommandObject = {
	pattern: "zanpakuto release~",
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

		if (!actor.knowsAbilityById(ABILITY_ID)) {
			actor.sendMessage(
				"You don't know that ability.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		if (!room) {
			actor.sendMessage(
				"You are not in a room.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		act(
			{
				user: `You release the true power of your zanpakuto!`,
				room: `{User} releases the true power of their zanpakuto!`,
			},
			{
				user: actor,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.COMBAT }
		);

		// TODO: Implement actual zanpakuto release mechanics (e.g., transform weapon, gain buffs, etc.)
		actor.useAbility(ability, 1);
	},
};
