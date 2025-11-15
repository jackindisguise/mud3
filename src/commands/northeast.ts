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
import { DEFAULT_COMMAND_VALUES, executeMovement } from "./_movement.js";

export default {
	...DEFAULT_COMMAND_VALUES,
	pattern: "northeast~",
	aliases: ["ne"],
	execute(context: CommandContext): void {
		executeMovement(context, DIRECTION.NORTHEAST);
	},
} satisfies CommandObject;
