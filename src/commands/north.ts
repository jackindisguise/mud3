/**
 * North movement command.
 *
 * @example
 * ```
 * north
 * n
 * ```
 *
 * **Aliases:** `n`
 * **Pattern:** `north~`
 * @module commands/north
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
	cooldown: getCooldownFunctionForDirection(DIRECTION.NORTH),
	pattern: "north~",
	aliases: ["n"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.NORTH);
	},
} satisfies CommandObject;
