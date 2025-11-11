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
import { executeMovement } from "./_movement.js";

export default {
	pattern: "east~",
	aliases: ["e"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.EAST);
	},
} satisfies CommandObject;
