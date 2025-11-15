/**
 * Up movement command.
 *
 * @example
 * ```
 * up
 * u
 * ```
 *
 * **Aliases:** `u`
 * **Pattern:** `up~`
 * @module commands/up
 */

import { CommandContext, PRIORITY } from "../command.js";
import { DIRECTION } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import { DEFAULT_COMMAND_VALUES, executeMovement } from "./_movement.js";

export default {
	...DEFAULT_COMMAND_VALUES,
	pattern: "up~",
	aliases: ["u"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.UP);
	},
} satisfies CommandObject;
