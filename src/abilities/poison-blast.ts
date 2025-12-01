/**
 * Poison Blast ability - Blasts the target with a poison nova, inflicting poison.
 *
 * This ability applies a poison effect that deals damage over time.
 *
 * @example
 * ```
 * poison blast <target>
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { act } from "../act.js";
import { effectTemplate as poisonTemplate } from "../effects/poison.js";

export const ABILITY_ID = "poison-blast";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Poison Blast",
	description: "Blasts the target with a poison nova, inflicting poison.",
	proficiencyCurve: [100, 200, 400, 800],
};

export const effectTemplate = {
	...poisonTemplate,
};

const COOLDOWN_MS = 3000;

export const command: CommandObject = {
	pattern: "poison blast <target:mob>",
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

		// Check if actor knows this ability
		if (!actor.knowsAbilityById(ABILITY_ID)) {
			actor.sendMessage(
				"You don't know that ability.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if in a room
		if (!room) {
			actor.sendMessage(
				"You are not in a room.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Get target
		const target = args.get("target") as Mob | undefined;
		if (!target) {
			actor.sendMessage(
				"You need to specify a target.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if target is in the same room
		if (target.location !== room) {
			actor.sendMessage(
				"They are not in the same room as you.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if target is alive
		if (target.health <= 0) {
			actor.sendMessage(
				"They are already dead.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Send messages
		act(
			{
				user: `You blast {target} with a poison nova!`,
				target: `{User} blasts you with a poison nova!`,
				room: `{User} blasts {target} with a poison nova!`,
			},
			{
				user: actor,
				target: target,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.COMBAT }
		);

		// Get proficiency to scale damage
		const proficiencyPercent = actor.learnedAbilities.get(ability.id) ?? 0;

		// Scale damage based on proficiency (0% = base damage, 100% = 2x damage)
		const scaledDamage = Math.floor(
			effectTemplate.damage * (1 + proficiencyPercent / 100)
		);

		// Apply poison effect
		target.addEffect(effectTemplate, actor, {
			damage: scaledDamage,
		});

		// Use ability (increment uses)
		actor.useAbility(ability, 1);
	},
};
