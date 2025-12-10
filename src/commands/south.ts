/**
 * South movement command.
 *
 * @example
 * ```
 * south
 * s
 * ```
 *
 * **Aliases:** `s`
 * **Pattern:** `south~`
 * @module commands/south
 */

import { CommandContext, PRIORITY } from "../core/command.js";
import { DIRECTION } from "../direction.js";
import { CommandObject } from "../package/commands.js";
import {
	DEFAULT_COMMAND_VALUES,
	executeMovement,
	getCooldownFunctionForDirection,
} from "./_movement.js";

export const command = {
	...DEFAULT_COMMAND_VALUES,
	cooldown: getCooldownFunctionForDirection(DIRECTION.SOUTH),
	pattern: "south~",
	aliases: ["s"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.SOUTH);
	},
} satisfies CommandObject;
