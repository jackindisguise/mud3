/**
 * Integrated Armor ability - Armor integrated into your body.
 *
 * @example
 * ```
 * integrated armor
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { effectTemplate } from "../effects/integrated-armor.js";

export const ABILITY_ID = "integrated-armor";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Integrated Armor",
	description: "Activate your integrated armor to bolster your defenses.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 12000;

export const command: CommandObject = {
	pattern: "'integrated armor'~",
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

		const proficiencyPercent = actor.learnedAbilities.get(ability.id) ?? 0;
		const scaledAbsorption = Math.floor(
			effectTemplate.absorption * (1 + proficiencyPercent / 100)
		);

		actor.addEffect({ ...effectTemplate, absorption: scaledAbsorption }, actor);

		actor.useAbility(ability, 1);
	},
};
