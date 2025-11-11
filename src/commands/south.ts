/**
 * South movement command.
 *
 * @example
 * ```
 * south
 * s
 * ```
 *
 * **Aliases:** `s`
 * **Pattern:** `south~`
 * @module commands/south
 */

import { CommandContext, PRIORITY } from "../command.js";
import { DIRECTION } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import { executeMovement } from "./_movement.js";

export default {
	pattern: "south~",
	aliases: ["s"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.SOUTH);
	},
} satisfies CommandObject;
