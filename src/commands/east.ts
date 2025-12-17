/**
 * East movement command.
 *
 * @example
 * ```
 * east
 * e
 * ```
 *
 * **Aliases:** `e`
 * **Pattern:** `east~`
 * @module commands/east
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
	cooldown: getCooldownFunctionForDirection(DIRECTION.EAST),
	pattern: "east~",
	aliases: ["e"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.EAST);
	},
} satisfies CommandObject;
