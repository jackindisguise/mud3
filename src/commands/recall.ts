/**
 * Recall command - Teleports the player to the recall location.
 *
 * @example
 * ```
 * recall
 * ```
 *
 * **Pattern:** `recall~`
 * @module commands/recall
 */

import { CommandContext, PRIORITY } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { getLocation, LOCATION } from "../registry/locations.js";
import { act } from "../act.js";
import { showRoom } from "./look.js";

export default {
	pattern: "recall~",
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		const { actor, room } = context;

		if (!room) {
			actor.sendMessage(
				"You are not in a room.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// Get the recall location
		const recallRoom = getLocation(LOCATION.RECALL);
		if (!recallRoom) {
			actor.sendMessage(
				"The recall location is not configured.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		// If already at recall location, do nothing
		if (actor.location === recallRoom) {
			actor.sendMessage(
				"You are already at the recall location.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		actor.combatTarget = undefined;
		const sourceRoom = room;

		// Move to recall room
		actor.move({
			location: recallRoom,
			scripts: {
				beforeOnExit: () => {
					act(
						{
							user: "You recall to safety.",
							room: "{User} recalls away.",
						},
						{
							user: actor,
							room: sourceRoom,
						},
						{ excludeUser: true }
					);
				},
				beforeOnEnter: () => {
					act(
						{
							user: "You arrive at the recall location.",
							room: "{User} arrives.",
						},
						{
							user: actor,
							room: recallRoom,
						},
						{ excludeUser: true }
					);

					if (actor.character?.settings?.autoLook) showRoom(actor, recallRoom);
				},
			},
		});
	},
} satisfies CommandObject;
