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
import { executeMovement } from "./_movement.js";

export default {
	pattern: "southeast~",
	aliases: ["se"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.SOUTHEAST);
	},
} satisfies CommandObject;
