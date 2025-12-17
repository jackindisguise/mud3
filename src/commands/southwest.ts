/**
 * Southwest movement command.
 *
 * @example
 * ```
 * southwest
 * sw
 * ```
 *
 * **Aliases:** `sw`
 * **Pattern:** `southwest~`
 * @module commands/southwest
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
	cooldown: getCooldownFunctionForDirection(DIRECTION.SOUTHWEST),
	pattern: "southwest~",
	aliases: ["sw"],
	priority: PRIORITY.LOW,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.SOUTHWEST);
	},
} satisfies CommandObject;
