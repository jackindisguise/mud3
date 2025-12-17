/**
 * Mimic Call ability - Mimic the calls of others.
 *
 * @example
 * ```
 * mimic call
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { act } from "../utils/act.js";

export const ABILITY_ID = "mimic-call";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Mimic Call",
	description: "Mimic the calls and sounds of others to confuse or distract.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 10000;

export const command: CommandObject = {
	pattern: "'mimic call'~",
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
				user: `You mimic the calls and sounds of others!`,
				room: `{User} emits strange calls and sounds!`,
			},
			{
				user: actor,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.COMBAT }
		);

		// TODO: Implement actual mimic mechanics (e.g., confuse enemies, distract, etc.)
		actor.useAbility(ability, 1);
	},
};
