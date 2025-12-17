/**
 * Shield Bash ability - Bash your target with your shield.
 *
 * @example
 * ```
 * shield bash <target>
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room, EQUIPMENT_SLOT, Weapon } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { act } from "../utils/act.js";
import { oneHit } from "../systems/combat.js";

export const ABILITY_ID = "shield-bash";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Shield Bash",
	description:
		"Bash your target with your shield, dealing damage and potentially stunning them.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 4000;
const BASE_DAMAGE_MULTIPLIER = 1.5;

export const command: CommandObject = {
	pattern: "'shield bash'~ <target:mob?>",
	cooldown(context: CommandContext, args: Map<string, any>) {
		const { actor, room } = context;
		if (!actor.knowsAbilityById(ABILITY_ID)) {
			return 0;
		}
		if (!room) {
			return 0;
		}
		let target = args.get("target") as Mob | undefined;
		if (!target) target = actor.combatTarget;
		if (!target) return 0;
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

		let target = args.get("target") as Mob | undefined;
		if (!target) target = actor.combatTarget;
		if (!target) {
			actor.sendMessage(
				"You need to specify a target.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		if (target.location !== room) {
			actor.sendMessage(
				"They are not in the same room as you.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		act(
			{
				user: `You bash {target} with your shield!`,
				target: `{User} bashes you with their shield!`,
				room: `{User} bashes {target} with their shield!`,
			},
			{
				user: actor,
				target: target,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.COMBAT }
		);

		const proficiencyPercent = actor.learnedAbilities.get(ability.id) ?? 0;
		const damageMultiplier =
			BASE_DAMAGE_MULTIPLIER * (1 + proficiencyPercent / 100);

		oneHit({
			attacker: actor,
			target: target,
			guaranteedHit: false,
			abilityName: ability.name.toLowerCase(),
			attackPowerMultiplier: damageMultiplier,
		});

		actor.useAbility(ability, 1);
	},
};
