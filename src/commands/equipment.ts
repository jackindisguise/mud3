/**
 * Equipment command for viewing equipped gear.
 *
 * Shows all equipment currently equipped, organized by slot.
 *
 * @example
 * ```
 * equipment
 * gear
 * eq
 * ```
 *
 * **Patterns:**
 * - `equipment` - Show equipped gear
 * @module commands/equipment
 */

import { CommandContext, PRIORITY } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { CommandObject } from "../package/commands.js";
import { LINEBREAK } from "../telnet.js";
import { getEquipmentList } from "../equipment.js";

export default {
	pattern: "equipment",
	aliases: ["gear~", "eq"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		const { actor } = context;

		// Build equipment list by slot
		const lines: string[] = getEquipmentList(actor);
		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
