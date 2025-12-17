/**
 * Stone Spike ability - Summon a spike of stone from the ground.
 *
 * @example
 * ```
 * stone spike <target>
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { act } from "../utils/act.js";
import { oneMagicHit } from "../systems/combat.js";
import { COMMON_HIT_TYPES } from "../core/damage-types.js";

export const ABILITY_ID = "stone-spike";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Stone Spike",
	description: "Summon a spike of stone from the ground to impale your target.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 4000;
const BASE_DAMAGE_MULTIPLIER = 1.8;

export const command: CommandObject = {
	pattern: "'stone spike'~ <target:mob?>",
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
				user: `You summon a spike of stone from the ground to impale {target}!`,
				target: `{User} summons a spike of stone from the ground to impale you!`,
				room: `{User} summons a spike of stone from the ground to impale {target}!`,
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
		const hitType = COMMON_HIT_TYPES.get("impact")!;

		oneMagicHit({
			attacker: actor,
			target: target,
			guaranteedHit: false,
			abilityName: ability.name.toLowerCase(),
			hitType: hitType,
			spellPowerMultiplier: damageMultiplier,
		});

		actor.useAbility(ability, 1);
	},
};
