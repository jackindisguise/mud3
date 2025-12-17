/**
 * Phase Strike ability - Strike through dimensions.
 *
 * @example
 * ```
 * phase strike <target>
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room, EQUIPMENT_SLOT, Weapon } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { act } from "../utils/act.js";
import { oneHit } from "../registry/combat.js";

export const ABILITY_ID = "phase-strike";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Phase Strike",
	description: "Strike your target by phasing through dimensions.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 5000;
const BASE_DAMAGE_MULTIPLIER = 2.0;

export const command: CommandObject = {
	pattern: "'phase strike'~ <target:mob?>",
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

		const mainHand = actor.getEquipped(EQUIPMENT_SLOT.MAIN_HAND);
		const weapon = mainHand instanceof Weapon ? mainHand : undefined;

		act(
			{
				user: `You phase through dimensions and strike {target}!`,
				target: `{User} phases through dimensions and strikes you!`,
				room: `{User} phases through dimensions and strikes {target}!`,
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
			guaranteedHit: true,
			abilityName: ability.name.toLowerCase(),
			attackPowerMultiplier: damageMultiplier,
			weapon,
		});

		actor.useAbility(ability, 1);
	},
};
