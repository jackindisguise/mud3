/**
 * Down movement command.
 *
 * @example
 * ```
 * down
 * d
 * ```
 *
 * **Aliases:** `d`
 * **Pattern:** `down~`
 * @module commands/down
 */

import { CommandContext, PRIORITY } from "../core/command.js";
import { DIRECTION } from "../utils/direction.js";
import { CommandObject } from "../package/commands.js";
import {
	DEFAULT_COMMAND_VALUES,
	executeMovement,
	getCooldownFunctionForDirection,
} from "./_movement.js";

export const command = {
	...DEFAULT_COMMAND_VALUES,
	cooldown: getCooldownFunctionForDirection(DIRECTION.DOWN),
	pattern: "down~",
	aliases: ["d"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.DOWN);
	},
} satisfies CommandObject;
