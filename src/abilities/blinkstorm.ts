/**
 * Blinkstorm ability - A storm of teleportation strikes.
 *
 * @example
 * ```
 * blinkstorm
 * ```
 */

import { CommandContext } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room, EQUIPMENT_SLOT, Weapon } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../core/ability.js";
import { act } from "../utils/act.js";
import { oneHit } from "../systems/combat.js";
import { consumeExhaustion, hasEnoughExhaustion } from "../utils/resources.js";

export const ABILITY_ID = "blinkstorm";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Blinkstorm",
	description: "Teleport rapidly between enemies, striking them all.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 12000;
const BASE_DAMAGE_MULTIPLIER = 1.5;
const EXHAUSTION_COST = 25;

export const command: CommandObject = {
	pattern: "blinkstorm~",
	cooldown(context: CommandContext, args: Map<string, any>) {
		const { actor, room } = context;
		if (!actor.knowsAbilityById(ABILITY_ID)) {
			return 0;
		}
		if (!hasEnoughExhaustion(actor, EXHAUSTION_COST)) {
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

		const enemies = room!.contents.filter(
			(obj) => obj instanceof Mob && obj !== actor && obj.health > 0
		);

		if (!consumeExhaustion(actor, EXHAUSTION_COST)) {
			return;
		}

		if (enemies.length === 0) {
			actor.sendMessage(
				"There are no enemies to strike with your blinkstorm!",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		act(
			{
				user: `You teleport rapidly between enemies, striking them all!`,
				room: `{User} teleports rapidly, striking all enemies!`,
			},
			{
				user: actor,
				room: room!,
			},
			{ messageGroup: MESSAGE_GROUP.COMBAT }
		);

		const mainHand = actor.getEquipped(EQUIPMENT_SLOT.MAIN_HAND);
		const weapon = mainHand instanceof Weapon ? mainHand : undefined;
		const proficiencyPercent = actor.learnedAbilities.get(ability.id) ?? 0;
		const damageMultiplier = 1.5 * (1 + proficiencyPercent / 100);

		let hitCount = 0;
		for (const enemy of enemies) {
			if (!(enemy instanceof Mob)) continue;

			const damage = oneHit({
				attacker: actor,
				target: enemy,
				guaranteedHit: false,
				abilityName: ability.name.toLowerCase(),
				attackPowerMultiplier: damageMultiplier * 0.7,
				weapon,
			});

			if (damage > 0) {
				hitCount++;
			}
		}

		actor.useAbility(ability, hitCount);
	},
};
