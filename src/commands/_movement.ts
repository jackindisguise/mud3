/**
 * Shared movement command execution logic.
 *
 * This module provides a centralized function for handling movement commands
 * to reduce code duplication across direction-specific command files.
 *
 * @module commands/_movement
 */

import { CommandContext } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { Room, DIRECTION, dir2text } from "../dungeon.js";

/**
 * Executes a movement command in the specified direction.
 *
 * @param context The command context containing actor and room
 * @param direction The direction to move
 */
export function executeMovement(
	context: CommandContext,
	direction: DIRECTION
): void {
	const { actor, room } = context;
	const directionText = dir2text(direction);

	if (!room) {
		actor.sendMessage("You are not in a room.", MESSAGE_GROUP.COMMAND_RESPONSE);
		return;
	}

	if (!actor.canStep(direction)) {
		actor.sendMessage(
			`You cannot go ${directionText}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return;
	}

	const destination = actor.getStep(direction);
	if (!destination || !(destination instanceof Room)) {
		actor.sendMessage(
			`You cannot go ${directionText}.`,
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
		return;
	}

	actor.step(direction);
}
