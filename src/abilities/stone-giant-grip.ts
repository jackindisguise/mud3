/**
 * Stone Giant Grip ability - The crushing grip of a stone giant.
 *
 * @example
 * ```
 * stone giant grip <target>
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room, EQUIPMENT_SLOT, Weapon } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { act } from "../systems/act.js";
import { oneHit } from "../systems/combat.js";

export const ABILITY_ID = "stone-giant-grip";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Stone Giant Grip",
	description: "Crush your target with the grip of a stone giant.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 6000;
const BASE_DAMAGE_MULTIPLIER = 2.3;

export const command: CommandObject = {
	pattern: "'stone giant grip'~ <target:mob?>",
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
				user: `You crush {target} with the grip of a stone giant!`,
				target: `{User} crushes you with the grip of a stone giant!`,
				room: `{User} crushes {target} with the grip of a stone giant!`,
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
			weapon,
		});

		actor.useAbility(ability, 1);
	},
};
