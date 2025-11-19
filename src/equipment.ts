import { EQUIPMENT_SLOT, Mob } from "./dungeon.js";
import { COLOR, color, SIZER, stickyColor } from "./color.js";
import { string } from "mud-ext";

/**
 * Get the order of equipment slots for display.
 */
export function getSlotOrder(): EQUIPMENT_SLOT[] {
	return [
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
}

/**
 * Get display names for equipment slots.
 */
export function getSlotNames(): Record<EQUIPMENT_SLOT, string> {
	return {
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
}

/**
 * Get a formatted list of equipment for a mob.
 */
export function getEquipmentList(mob: Mob): string[] {
	const lines: string[] = [];
	const slotOrder = getSlotOrder();
	const slotNames = getSlotNames();
	for (const slot of slotOrder) {
		const equipment = mob.getEquipped(slot);
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
	return lines;
}
