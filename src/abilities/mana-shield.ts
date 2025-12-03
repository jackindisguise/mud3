/**
 * Mana Shield ability - A shield of pure mana.
 *
 * @example
 * ```
 * mana shield
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { effectTemplate } from "../effects/mana-shield.js";

export const ABILITY_ID = "mana-shield";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Mana Shield",
	description: "Create a protective shield of pure mana around yourself.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 5000;

export const command: CommandObject = {
	pattern: "mana shield~",
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

		// Get proficiency to scale absorption
		const proficiencyPercent = actor.learnedAbilities.get(ability.id) ?? 0;
		const scaledAbsorption = Math.floor(
			effectTemplate.absorption * (1 + proficiencyPercent / 100)
		);

		// Apply shield effect
		actor.addEffect({ ...effectTemplate, absorption: scaledAbsorption }, actor);

		actor.useAbility(ability, 1);
	},
};
