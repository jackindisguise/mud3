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

import { CommandContext, PRIORITY } from "../command.js";
import { DIRECTION } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import { DEFAULT_COMMAND_VALUES, executeMovement } from "./_movement.js";

export default {
	...DEFAULT_COMMAND_VALUES,
	pattern: "east~",
	aliases: ["e"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.EAST);
	},
} satisfies CommandObject;
