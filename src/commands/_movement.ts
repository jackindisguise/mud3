/**
 * Shared movement command execution logic.
 *
 * This module provides a centralized function for handling movement commands
 * to reduce code duplication across direction-specific command files.
 *
 * @module commands/_movement
 */

import { CommandContext, PRIORITY } from "../core/command.js";
import { MESSAGE_GROUP } from "../core/character.js";
import { Room, DIRECTION, dir2text } from "../core/dungeon.js";
import { CommandObject } from "../package/commands.js";
import { showRoom } from "./look.js";

const DEFAULT_COOLDOWN_MS = 100;

export function getCooldownFunctionForDirection(
	direction: DIRECTION
): (context: CommandContext, args: Map<string, any>) => number {
	return (context: CommandContext, args: Map<string, any>): number => {
		const { actor, room } = context;
		if (!room) {
			return 0;
		}
		if (actor.isInCombat()) {
			return 0;
		}
		if (!actor.canStep(direction)) {
			return 0;
		}
		return DEFAULT_COOLDOWN_MS;
	};
}

export const DEFAULT_COMMAND_VALUES: Partial<CommandObject> = {
	priority: PRIORITY.HIGH,
};

/**
 * Executes a movement command in the specified direction.
 *
 * @param context The command context containing actor and room
 * @param direction The direction to move
 * @returns true if the actor successfully moved, false otherwise
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

	// Prevent movement if in combat
	if (actor.isInCombat()) {
		actor.sendMessage(
			"You cannot move while in combat!",
			MESSAGE_GROUP.COMMAND_RESPONSE
		);
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

	actor.sendMessage(
		`You leave to the ${directionText}.`,
		MESSAGE_GROUP.COMMAND_RESPONSE
	);

	const success = actor.step(direction);
	if (success && actor.character?.settings?.autoLook)
		showRoom(actor, actor.location as Room);
}
