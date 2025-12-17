/**
 * Mournful Wail ability - A wail that brings sorrow.
 *
 * @example
 * ```
 * mournful wail
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { act } from "../systems/act.js";
import { effectTemplate } from "../effects/mournful-wail.js";

export const ABILITY_ID = "mournful-wail";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Mournful Wail",
	description: "Emit a mournful wail that weakens your enemies.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 10000;

export const command: CommandObject = {
	pattern: "'mournful wail'~",
	cooldown(context: CommandContext, args: Map<string, any>) {
		const { actor, room } = context;
		if (!actor.knowsAbilityById(ABILITY_ID)) {
			return 0;
		}
		if (!room) {
			return 0;
		}
		const enemies = room.contents.filter(
			(obj) => obj instanceof Mob && obj !== actor && obj.health > 0
		);
		if (enemies.length === 0) return 0;
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

		const enemies = room.contents.filter(
			(obj) => obj instanceof Mob && obj !== actor && obj.health > 0
		);

		if (enemies.length === 0) {
			actor.sendMessage(
				"There are no enemies to weaken with your mournful wail!",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		act(
			{
				user: `You emit a mournful wail that weakens your enemies!`,
				room: `{User} emits a mournful wail that weakens those nearby!`,
			},
			{
				user: actor,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.COMBAT }
		);

		for (const enemy of enemies) {
			if (!(enemy instanceof Mob)) continue;
			enemy.addEffect(effectTemplate, actor, {
				duration: 30, // 30 seconds
			});
		}

		actor.useAbility(ability, enemies.length);
	},
};
