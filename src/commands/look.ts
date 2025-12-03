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
import { Room, DungeonObject } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { DIRECTION, dir2text } from "../direction.js";
import { CommandContext, PRIORITY } from "../core/command.js";
import {
	showRoom,
	showObject,
	showContainerContents,
} from "../utils/display.js";

export default {
	pattern: "look~",
	aliases: [
		"look~ <target:object@all>",
		"look~ <direction:direction>",
		"look~ in~ <container:object@all>",
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
} satisfies CommandObject;
