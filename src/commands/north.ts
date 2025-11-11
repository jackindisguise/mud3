/**
 * North movement command.
 *
 * @example
 * ```
 * north
 * n
 * ```
 *
 * **Aliases:** `n`
 * **Pattern:** `north~`
 * @module commands/north
 */

import { CommandContext, PRIORITY } from "../command.js";
import { DIRECTION } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import { executeMovement } from "./_movement.js";

export default {
	pattern: "north~",
	aliases: ["n"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.NORTH);
	},
} satisfies CommandObject;
