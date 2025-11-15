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

import { CommandContext, PRIORITY } from "../command.js";
import { DIRECTION } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import { DEFAULT_COMMAND_VALUES, executeMovement } from "./_movement.js";

export default {
	...DEFAULT_COMMAND_VALUES,
	pattern: "west~",
	aliases: ["w"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.WEST);
	},
} satisfies CommandObject;
