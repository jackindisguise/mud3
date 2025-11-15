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
import { DEFAULT_COMMAND_VALUES, executeMovement } from "./_movement.js";

export default {
	...DEFAULT_COMMAND_VALUES,
	pattern: "southwest~",
	aliases: ["sw"],
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.SOUTHWEST);
	},
} satisfies CommandObject;
