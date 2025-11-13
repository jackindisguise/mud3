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
import { EQUIPMENT_SLOT } from "../equipment.js";
import { CommandObject } from "../package/commands.js";
import { LINEBREAK } from "../telnet.js";
import { COLOR, color, SIZER, stickyColor } from "../color.js";
import { string } from "mud-ext";

/**
 * Format slot name for display (e.g., "mainHand" -> "Main Hand")
 */
function formatSlotName(slot: string): string {
	return slot
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (str) => str.toUpperCase())
		.trim();
}

const slotOrder: EQUIPMENT_SLOT[] = [
	EQUIPMENT_SLOT.HEAD,
	EQUIPMENT_SLOT.NECK,
	EQUIPMENT_SLOT.SHOULDERS,
	EQUIPMENT_SLOT.CHEST,
	EQUIPMENT_SLOT.HANDS,
	EQUIPMENT_SLOT.FINGER,
	EQUIPMENT_SLOT.WAIST,
	EQUIPMENT_SLOT.LEGS,
	EQUIPMENT_SLOT.FEET,
	EQUIPMENT_SLOT.MAIN_HAND,
	EQUIPMENT_SLOT.OFF_HAND,
];

const slotNames: Record<EQUIPMENT_SLOT, string> = {
	[EQUIPMENT_SLOT.HEAD]: "Head",
	[EQUIPMENT_SLOT.NECK]: "Neck",
	[EQUIPMENT_SLOT.SHOULDERS]: "Shoulders",
	[EQUIPMENT_SLOT.CHEST]: "Chest",
	[EQUIPMENT_SLOT.HANDS]: "Hands",
	[EQUIPMENT_SLOT.FINGER]: "Finger",
	[EQUIPMENT_SLOT.WAIST]: "Waist",
	[EQUIPMENT_SLOT.LEGS]: "Legs",
	[EQUIPMENT_SLOT.FEET]: "Feet",
	[EQUIPMENT_SLOT.MAIN_HAND]: "Main Hand",
	[EQUIPMENT_SLOT.OFF_HAND]: "Off Hand",
};

export default {
	pattern: "equipment",
	aliases: ["gear~", "eq"],
	priority: PRIORITY.HIGH,
	execute(context: CommandContext): void {
		const { actor } = context;

		// Build equipment list by slot
		const lines: string[] = [];
		for (const slot of slotOrder) {
			const equipment = actor.getEquipped(slot);
			const inside = color(`Worn on ${slotNames[slot]}`, COLOR.OLIVE);
			const prefix = string.pad({
				string: stickyColor(`<${inside}>`, COLOR.YELLOW),
				width: 20,
				textAlign: string.ALIGN.LEFT,
				sizer: SIZER,
			});
			if (equipment)
				lines.push(stickyColor(`${prefix} ${equipment.display}`, COLOR.CYAN));
			else lines.push(stickyColor(`${prefix} [NOTHING]`, COLOR.TEAL));
		}

		actor.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
	},
} satisfies CommandObject;
