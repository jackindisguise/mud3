/**
 * Radiant Burst ability - A burst of radiant energy.
 *
 * @example
 * ```
 * radiant burst
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

export const ABILITY_ID = "radiant-burst";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Radiant Burst",
	description: "A burst of radiant energy that damages nearby enemies.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 5000;

export const command: CommandObject = {
	pattern: "'radiant burst'~",
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
				"There are no enemies to hit with your radiant burst!",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		act(
			{
				user: `You unleash a burst of radiant energy!`,
				room: `{User} unleashes a burst of radiant energy!`,
			},
			{
				user: actor,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.COMBAT }
		);

		const proficiencyPercent = actor.learnedAbilities.get(ability.id) ?? 0;
		const damageMultiplier = 1.2 * (1 + proficiencyPercent / 100);
		const hitType = COMMON_HIT_TYPES.get("smite")!;

		let hitCount = 0;
		for (const enemy of enemies) {
			if (!(enemy instanceof Mob)) continue;

			const damage = oneMagicHit({
				attacker: actor,
				target: enemy,
				guaranteedHit: false,
				abilityName: ability.name.toLowerCase(),
				hitType: hitType,
				spellPowerMultiplier: damageMultiplier * 0.6,
			});

			if (damage > 0) {
				hitCount++;
			}
		}

		actor.useAbility(ability, hitCount);
	},
};
