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

		const sourceRoom = room;

		// Trigger exit event on source room
		if (sourceRoom instanceof Room) {
			sourceRoom.onExit(actor);
		}

		// Move to recall room
		actor.move(recallRoom);

		// Trigger enter event on destination room
		if (recallRoom instanceof Room) {
			recallRoom.onEnter(actor);
		}

		// Send messages
		act(
			{
				user: "You recall to safety.",
				room: "{User} recalls away.",
			},
			{
				user: actor,
				room: sourceRoom,
			}
		);

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

		// Show room description if auto-look is enabled
		if (actor.character?.settings?.autoLook) {
			showRoom(actor, recallRoom);
		}
	},
} satisfies CommandObject;
