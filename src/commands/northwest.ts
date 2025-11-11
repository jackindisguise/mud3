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
import { executeMovement } from "./_movement.js";

export default {
	pattern: "northwest~",
	aliases: ["nw"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.NORTHWEST);
	},
} satisfies CommandObject;
