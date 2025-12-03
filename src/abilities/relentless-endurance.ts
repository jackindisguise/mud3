/**
 * Relentless Endurance ability - Endurance that never gives up.
 *
 * @example
 * ```
 * relentless endurance
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { effectTemplate } from "../effects/relentless-endurance.js";

export const ABILITY_ID = "relentless-endurance";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Relentless Endurance",
	description: "Push beyond your limits with relentless determination.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 20000;

export const command: CommandObject = {
	pattern: "'relentless endurance'~",
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
			duration: 60,
		});

		actor.useAbility(ability, 1);
	},
};
