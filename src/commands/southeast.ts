/**
 * Southeast movement command.
 *
 * @example
 * ```
 * southeast
 * se
 * ```
 *
 * **Aliases:** `se`
 * **Pattern:** `southeast~`
 * @module commands/southeast
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
	cooldown: getCooldownFunctionForDirection(DIRECTION.SOUTHEAST),
	pattern: "southeast~",
	aliases: ["se"],
	priority: PRIORITY.LOW,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.SOUTHEAST);
	},
} satisfies CommandObject;
