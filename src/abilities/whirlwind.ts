/**
 * Whirlwind ability - A spinning attack that hits all nearby enemies.
 *
 * This ability allows a mob to perform a spinning attack that damages
 * all enemies in the same room.
 *
 * @example
 * ```
 * whirlwind
 * ```
 */

import { CommandContext } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { Mob } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import { Ability } from "../ability.js";
import { act, damageMessage } from "../act.js";

export const ABILITY_ID = "whirlwind";

export const ability: Ability = {
	id: ABILITY_ID,
	name: "Whirlwind",
	description: "A spinning attack that hits all nearby enemies in the room.",
	proficiencyCurve: [100, 200, 400, 800],
};

const COOLDOWN_MS = 1000;

export const command: CommandObject = {
	pattern: "whirlwind~",
	cooldown(context: CommandContext, args: Map<string, any>) {
		const { actor, room } = context;
		const character = actor.character;
		if (!actor.knowsAbility(ABILITY_ID)) {
			return 0;
		}
		if (!room) {
			return 0;
		}
		if (actor.health <= 0) {
			return 0;
		}
		return COOLDOWN_MS;
	},

	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor, room } = context;
		const character = actor.character;

		// Check if actor knows this ability
		if (!actor.knowsAbility(ABILITY_ID)) {
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

		// Check if actor is dead
		if (actor.health <= 0) {
			actor.sendMessage(
				"You are dead and cannot use abilities.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Find all enemy mobs in the room (excluding self)
		const enemies = room.contents.filter(
			(obj) => obj instanceof Mob && obj !== actor && obj.health > 0
		);

		if (enemies.length === 0) {
			actor.sendMessage(
				"There are no enemies to hit with your whirlwind!",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		act(
			{
				user: `You spin in a whirlwind!`,
				room: `{User} spins in a whirlwind!`,
			},
			{
				user: actor,
				room: room,
			},
			{ messageGroup: MESSAGE_GROUP.COMBAT }
		);

		// Hit all enemies
		let hitCount = 0;
		const hitEnemies: Mob[] = [];

		for (const enemy of enemies) {
			if (!(enemy instanceof Mob)) continue;

			// Perform the attack
			const damage = actor.oneHit({
				target: enemy,
				guaranteedHit: false,
				abilityName: ability.name.toLowerCase(),
				attackPowerMultiplier: 0.5,
			});

			if (damage > 0) {
				hitCount++;
				hitEnemies.push(enemy);
			}
		}

		actor.useAbilityById(ABILITY_ID, hitCount);
	},
};
