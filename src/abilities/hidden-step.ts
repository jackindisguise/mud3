/**
 * Hidden Step ability - Step into the shadows.
 *
 * @example
 * ```
 * hidden step
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { effectTemplate } from "../effects/hidden-step.js";

export const ABILITY_ID = "hidden-step";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Hidden Step",
	description: "Step into the shadows, becoming harder to detect.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 15000;

export const command: CommandObject = {
	pattern: "'hidden step'~",
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
