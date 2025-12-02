/**
 * Northwest movement command.
 *
 * @example
 * ```
 * northwest
 * nw
 * ```
 *
 * **Aliases:** `nw`
 * **Pattern:** `northwest~`
 * @module commands/northwest
 */

import { CommandContext, PRIORITY } from "../core/command.js";
import { DIRECTION } from "../direction.js";
import { CommandObject } from "../package/commands.js";
import {
	DEFAULT_COMMAND_VALUES,
	executeMovement,
	getCooldownFunctionForDirection,
} from "./_movement.js";

export default {
	...DEFAULT_COMMAND_VALUES,
	cooldown: getCooldownFunctionForDirection(DIRECTION.NORTHWEST),
	pattern: "northwest~",
	aliases: ["nw"],
	priority: PRIORITY.LOW,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.NORTHWEST);
	},
} satisfies CommandObject;
