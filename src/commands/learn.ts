/**
 * Learn command for learning abilities.
 *
 * Allows a player to learn an ability by its ID. The ability will be added
 * to the player's learned abilities with a default proficiency of 0.
 *
 * @example
 * ```
 * learn whirlwind
 * ```
 *
 * **Pattern:** `learn~ <abilityId:word>`
 * @module commands/learn
 */

import { CommandContext, ParseResult } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { CommandObject } from "../package/commands.js";
import { getAbilityById } from "../registry/ability.js";

export const command = {
	pattern: "learn~ <abilityId:text>",
	execute(context: CommandContext, args: Map<string, any>): void {
		const abilityId = args.get("abilityId") as string;
		const { actor } = context;
		const character = actor.character;

		if (!character) {
			actor.sendMessage(
				"Only players can learn abilities.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if the ability exists
		const ability = getAbilityById(abilityId);
		if (!ability) {
			actor.sendMessage(
				`There is no ability called "${abilityId}".`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if already learned
		if (actor.knowsAbilityById(abilityId)) {
			const proficiency = actor.learnedAbilities.get(abilityId) || 0;
			const uses = actor.getAbilityUses(abilityId);
			actor.sendMessage(
				`You already know ${ability.name} (${uses} uses, ${proficiency}% proficiency).`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Learn the ability with 0 uses
		actor.addAbility(ability, 0);
		actor.sendMessage(
			`You have learned ${ability.name}! ${ability.description}`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error?.includes("abilityId")) {
			context.actor.sendMessage(
				"What ability do you want to learn?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
