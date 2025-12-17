/**
 * Look command for viewing the current room, adjacent rooms, or objects.
 *
 * Allows players to view their current room description, look in a specific
 * direction to see an adjacent room, or look at objects in the room or inventory.
 * When looking at a mob, shows their equipped items. When looking at other objects,
 * shows their long description.
 *
 * @example
 * ```
 * look
 * l
 * look north
 * look n
 * look sword
 * look goblin
 * ```
 *
 * **Aliases:** `l`
 * **Pattern:** `look~ [<target:object@all>] [<direction:direction>]`
 * @module commands/look
 */

import { MESSAGE_GROUP } from "../core/character.js";
import { Room, DungeonObject, Item } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { DIRECTION, dir2text } from "../utils/direction.js";
import { CommandContext, PRIORITY, ParseResult } from "../core/command.js";
import {
	showRoom,
	showObject,
	showContainerContents,
} from "../utils/display.js";
import logger from "../utils/logger.js";
import { capitalizeFirst } from "../utils/string.js";

export const command = {
	pattern: "look~",
	aliases: [
		"look~ <target:object@all>",
		"look~ <direction:direction>",
		"look~ in~ <container:item@all>",
	],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor, room } = context;

		if (!room) {
			actor.sendMessage(
				"You are not in a room.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const target = args.get("target") as DungeonObject | undefined;
		const direction = args.get("direction") as DIRECTION | undefined;
		const container = args.get("container") as DungeonObject | undefined;

		// If container specified, show its contents
		if (container) {
			// Check if it's actually a container
			if (!(container instanceof Item) || !container.isContainer) {
				const containerName = container.display || container.keywords;
				actor.sendMessage(
					`${capitalizeFirst(containerName)} is not a container.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			// Check if container is accessible (in room or in actor's inventory)
			const containerLocation = container.location;
			if (containerLocation !== room && containerLocation !== actor) {
				actor.sendMessage(
					`You don't have access to ${
						container.display || container.keywords
					}.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			showContainerContents(actor, container);
			return;
		}

		// If target object is specified, show that object
		if (target) {
			showObject(actor, target);
			return;
		}

		// If direction specified, show that room
		if (direction) {
			// Check if we can move in that direction
			if (!actor.canStep(direction)) {
				actor.sendMessage(
					`You cannot look ${dir2text(direction)}.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			// Get the adjacent room
			const targetRoom = actor.getStep(direction);
			if (!targetRoom || !(targetRoom instanceof Room)) {
				actor.sendMessage(
					`You cannot look ${dir2text(direction)}.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			// Show the adjacent room
			actor.sendMessage(
				`Looking ${dir2text(direction)}...`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			showRoom(actor, targetRoom);
			return;
		}

		// If nothing specified, show current room
		showRoom(actor, room);
	},

	onError(context: CommandContext, result: ParseResult): void {
		if (result.error?.includes("Could not parse argument")) {
			// Check if it's the container argument that failed
			if (result.error?.includes("container")) {
				context.actor.sendMessage(
					"You don't see that container.",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}
			// For other arguments (target, direction)
			context.actor.sendMessage(
				"You don't see that here.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
		if (result.error?.includes("Missing required argument")) {
			context.actor.sendMessage(
				"What do you want to look at?",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}
	},
} satisfies CommandObject;
