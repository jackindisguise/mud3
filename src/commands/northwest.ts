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

import { CommandContext, PRIORITY } from "../command.js";
import { DIRECTION } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import { DEFAULT_COMMAND_VALUES, executeMovement } from "./_movement.js";

export default {
	...DEFAULT_COMMAND_VALUES,
	pattern: "northwest~",
	aliases: ["nw"],
	priority: PRIORITY.LOW,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.NORTHWEST);
	},
} satisfies CommandObject;
