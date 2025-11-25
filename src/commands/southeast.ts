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

import { CommandContext, PRIORITY } from "../command.js";
import { DIRECTION } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import {
	DEFAULT_COMMAND_VALUES,
	executeMovement,
	getCooldownFunctionForDirection,
} from "./_movement.js";

export default {
	...DEFAULT_COMMAND_VALUES,
	cooldown: getCooldownFunctionForDirection(DIRECTION.SOUTHEAST),
	pattern: "southeast~",
	aliases: ["se"],
	priority: PRIORITY.LOW,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.SOUTHEAST);
	},
} satisfies CommandObject;
