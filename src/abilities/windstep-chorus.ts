/**
 * Windstep Chorus ability - Move with the chorus of the wind.
 *
 * @example
 * ```
 * windstep chorus
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { effectTemplate } from "../effects/windstep-chorus.js";

export const ABILITY_ID = "windstep-chorus";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Windstep Chorus",
	description: "Move with the chorus of the wind, enhancing your mobility.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 18000;

export const command: CommandObject = {
	pattern: "windstep chorus~",
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

		actor.addEffect(effectTemplate, actor, {
			duration: 120,
		});

		actor.useAbility(ability, 1);
	},
};
