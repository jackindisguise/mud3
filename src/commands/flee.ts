/**
 * Flee command for attempting to escape in a random direction.
 *
 * Attempts to move in a random valid direction. Useful for escaping combat
 * or dangerous situations. Has a 5 second cooldown.
 *
 * @example
 * ```
 * flee
 * run
 * ```
 *
 * **Aliases:** `run`
 * **Pattern:** `flee~`
 * @module commands/flee
 */

import { CommandContext, PRIORITY } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { DIRECTION, DIRECTIONS, dir2text } from "../direction.js";
import { CommandObject } from "../package/commands.js";
import { act } from "../act.js";

export default {
	pattern: "flee~",
	aliases: ["run~", "escape~"],
	priority: PRIORITY.HIGH,
	cooldown: (context: CommandContext, args: Map<string, any>) => {
		const { actor } = context;
		if (!actor.isInCombat()) {
			return 0;
		}
		const validDirections: DIRECTION[] = [];
		for (const dir of DIRECTIONS)
			if (actor.canStep(dir)) validDirections.push(dir);
		if (validDirections.length === 0) return 0;
		return 5000;
	},
	execute(context: CommandContext): void {
		const { actor, room } = context;

		if (!room) {
			actor.sendMessage(
				"You are not in a room.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Flee can only be used when in combat
		if (!actor.isInCombat()) {
			actor.sendMessage(
				"You can only flee when in combat!",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// 33% chance of failure
		if (Math.random() < 0.33) {
			act(
				{
					user: "You try to flee... but fail!",
					room: "{User} tries to flee... but fails!",
				},
				{
					user: actor,
					room: room,
				}
			);
			return;
		}

		// Collect all valid directions the actor can step to
		const validDirections: DIRECTION[] = [];
		for (const dir of DIRECTIONS) {
			if (actor.canStep(dir)) {
				validDirections.push(dir);
			}
		}

		// Check if there are any valid directions
		if (validDirections.length === 0) {
			actor.sendMessage(
				"There is no way to flee!",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Pick a random valid direction
		const randomIndex = Math.floor(Math.random() * validDirections.length);
		const randomDirection = validDirections[randomIndex];
		const directionText = dir2text(randomDirection);

		// flee message
		act(
			{
				user: `You flee to the ${directionText}!`,
				room: `{User} flees to the ${directionText}!`,
			},
			{
				user: actor,
				room: room,
			}
		);

		// Attempt to move in that direction (bypasses combat check)
		actor.combatTarget = undefined;
		actor.step(randomDirection);
	},
} satisfies CommandObject;
