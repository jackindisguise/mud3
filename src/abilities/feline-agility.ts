/**
 * Feline Agility ability - The agility of a cat.
 *
 * @example
 * ```
 * feline agility
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { effectTemplate } from "../effects/feline-agility.js";

export const ABILITY_ID = "feline-agility";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Feline Agility",
	description:
		"Channel the swift agility of a cat to move with incredible speed.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 15000;

export const command: CommandObject = {
	pattern: "'feline agility'~",
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
