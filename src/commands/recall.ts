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
import { MoveOptions, Room } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { getLocation, LOCATION } from "../registry/locations.js";
import { act } from "../systems/act.js";

export const command = {
	pattern: "recall~",
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		const { actor, room } = context;

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

		const moveOptions: MoveOptions = {
			location: recallRoom,
			scripts: {
				beforeOnEnter: () => {
					act(
						{
							user: "You arrive at the recall location.",
							room: "{User} arrives.",
						},
						{
							user: actor,
							room: recallRoom,
						}
					);
				},
			},
		};

		// If the actor is in a room, add a beforeOnExit script to send a message
		if (sourceRoom)
			moveOptions.scripts!.beforeOnExit = () => {
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
			};

		actor.move(moveOptions);
	},
} satisfies CommandObject;
