/**
 * Southwest movement command.
 *
 * @example
 * ```
 * southwest
 * sw
 * ```
 *
 * **Aliases:** `sw`
 * **Pattern:** `southwest~`
 * @module commands/southwest
 */

import { CommandContext, PRIORITY } from "../command.js";
import { DIRECTION } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import { executeMovement } from "./_movement.js";

export default {
	pattern: "southwest~",
	aliases: ["sw"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.SOUTHWEST);
	},
} satisfies CommandObject;
