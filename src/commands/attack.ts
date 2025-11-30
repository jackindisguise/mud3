/**
 * Attack/engage command for initiating combat with another mob.
 *
 * Allows a mob to attack or engage another mob in combat. If the attacker is already
 * in combat with a different target, they will switch targets. The target will
 * automatically engage back if it's an NPC, or can be manually engaged by players.
 *
 * @example
 * ```
 * attack goblin
 * engage orc
 * kill troll
 * ```
 *
 * **Aliases:** `engage`, `kill`
 * **Pattern:** `attack~ <target:mob>`
 * @module commands/attack
 */

import { CommandContext, ParseResult, PRIORITY } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Mob, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { initiateCombat, addToCombatQueue } from "../combat.js";

export default {
	pattern: "attack~ <target:mob>",
	aliases: ["engage~ <target:mob>", "kill~ <target:mob>"],
	priority: PRIORITY.LOW,
	execute(context: CommandContext, args: Map<string, any>): void {
		const target = args.get("target") as Mob;
		const { actor, room } = context;

		if (!room) {
			actor.sendMessage(
				"You are not in a room.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Check if target is in the same room
		if (target.location !== room) {
			actor.sendMessage(
				`${target.display} is not here.`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Can't attack yourself
		if (target === actor) {
			actor.sendMessage(
				"You cannot attack yourself.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Initiate combat
		initiateCombat(actor, target);
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error?.includes("target")) {
			context.actor.sendMessage(
				"Who do you want to attack?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
