/**
 * West movement command.
 *
 * @example
 * ```
 * west
 * w
 * ```
 *
 * **Aliases:** `w`
 * **Pattern:** `west~`
 * @module commands/west
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
	cooldown: getCooldownFunctionForDirection(DIRECTION.WEST),
	pattern: "west~",
	aliases: ["w"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.WEST);
	},
} satisfies CommandObject;
