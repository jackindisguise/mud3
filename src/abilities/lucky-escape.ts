/**
 * Lucky Escape ability - Escape through sheer luck.
 *
 * @example
 * ```
 * lucky escape
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { act } from "../utils/act.js";

export const ABILITY_ID = "lucky-escape";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Lucky Escape",
	description: "Escape danger through a stroke of luck.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 30000;

export const command: CommandObject = {
	pattern: "lucky escape~",
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
				user: `You escape danger through a stroke of luck!`,
				room: `{User} escapes danger through a stroke of luck!`,
			},
			{
				user: actor,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.COMBAT }
		);

		// TODO: Implement actual escape mechanics (e.g., teleport, dodge next attack, etc.)
		actor.useAbility(ability, 1);
	},
};
