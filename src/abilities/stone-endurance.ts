/**
 * Stone Endurance ability - Endurance as strong as stone.
 *
 * @example
 * ```
 * stone endurance
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { effectTemplate } from "../effects/stone-endurance.js";

export const ABILITY_ID = "stone-endurance";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Stone Endurance",
	description: "Channel the endurance of stone to bolster your defenses.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 10000;

export const command: CommandObject = {
	pattern: "stone endurance~",
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
			duration: 30, // 30 seconds
		});

		actor.useAbility(ability, 1);
	},
};

