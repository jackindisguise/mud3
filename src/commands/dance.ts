/**
 * Dance command for performing a dance action, optionally with a target.
 *
 * Allows a player to dance, either alone or with another mob in the room.
 * Uses the act system to display appropriate messages to different observers.
 *
 * @example
 * ```
 * dance
 * dance bob
 * ```
 *
 * **Pattern:** `dance~ [target:mob?]`
 * @module commands/dance
 */

import { CommandContext, ParseResult } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { Mob } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import { act } from "../act.js";

export default {
	pattern: "dance~ [target:mob?]",
	execute(context: CommandContext, args: Map<string, any>): void {
		const target = args.get("target") as Mob | undefined;
		const { actor, room } = context;

		if (!room) {
			actor.sendMessage(
				"You are not in a room.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// If target is specified, validate it
		if (target) {
			// Check if target is in the same room
			if (target.location !== room) {
				actor.sendMessage(
					`${target.display} is not here.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			// Can't dance with yourself
			if (target === actor) {
				actor.sendMessage(
					"You cannot dance with yourself.",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			// Dance with target
			act(
				{
					user: "You start dancing with {target}.",
					room: "{User} starts dancing with {target}.",
					target: "{User} starts dancing with you.",
				},
				{
					user: actor,
					target: target,
					room: room,
				}
			);
		} else {
			// Dance alone
			act(
				{
					user: "You start dancing.",
					room: "{User} starts dancing.",
				},
				{
					user: actor,
					room: room,
				}
			);
		}
	},

	onError(context: CommandContext, result: ParseResult): void {
		// No specific error handling needed - target is optional
	},
} satisfies CommandObject;
