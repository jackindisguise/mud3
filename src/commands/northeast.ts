/**
 * Northeast movement command.
 *
 * @example
 * ```
 * northeast
 * ne
 * ```
 *
 * **Aliases:** `ne`
 * **Pattern:** `northeast~`
 * @module commands/northeast
 */

import { CommandContext, PRIORITY } from "../command.js";
import { DIRECTION } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import { executeMovement } from "./_movement.js";

export default {
	pattern: "northeast~",
	aliases: ["ne"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.NORTHEAST);
	},
} satisfies CommandObject;
