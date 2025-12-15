/**
 * Display utility functions for showing rooms and objects to players.
 *
 * Helper functions for displaying room descriptions, object information, and container contents.
 *
 * @module utils/display
 */

import { MESSAGE_GROUP } from "../core/character.js";
import { Room, DungeonObject, Item } from "../core/dungeon.js";
import { getEquipmentList } from "../core/equipment.js";
import { Mob } from "../core/dungeon.js";
import { COLOR, color, SIZER } from "../core/color.js";
import { LINEBREAK } from "../core/telnet.js";
import { string } from "mud-ext";
import { generateMinimap } from "../minimap.js";
import { DIRECTION, dir2text } from "../direction.js";
import { DIRECTIONS } from "../direction.js";

/**
 * Displays a room description to a player.
 * Shows the room's display name, description, contents, available exits, and a minimap.
 * The minimap is displayed on the left with room information on the right.
 *
 * @param mob The mob viewing the room
 * @param room The room to display
 * @param minimapSize Optional size for the minimap (default: 5, which shows a larger grid)
 */
export function showRoom(mob: Mob, room: Room, minimapSize: number = 5): void {
	const character = mob.character;
	if (!character) return;

	const lines: string[] = [];

	// Get minimap and split into lines
	const minimap = generateMinimap(room, mob, minimapSize);
	const minimapLines = minimap ?? [];

	// Calculate minimap width (find the longest line, accounting for color codes)
	let minimapWidth = 0;
	for (const line of minimapLines) {
		const displayWidth = SIZER.size(line);
		if (displayWidth > minimapWidth) {
			minimapWidth = displayWidth;
		}
	}
	// Add padding between minimap and room info
	const minimapColumnWidth = minimapWidth + 4;

	// Room description should be wrapped to 40 characters wide to account for minimap width
	const DESCRIPTION_WIDTH = 40;

	// Build room info lines (title and description only - for side-by-side display)
	const roomInfoLines: string[] = [];

	// Room title with coordinates
	if (room.display) {
		const coords = room.coordinates;
		const titleWithCoords = `${room.display} (${color(
			coords.x.toString(),
			COLOR.CYAN
		)}, ${color(coords.y.toString(), COLOR.CYAN)}, ${color(
			coords.z.toString(),
			COLOR.CYAN
		)})`;
		roomInfoLines.push(titleWithCoords);
	}

	// Room description - wrap to 40 characters wide
	if (room.description) {
		// Wrap the description to 40 characters wide
		const wrappedDescription = string.wrap(room.description, DESCRIPTION_WIDTH);
		roomInfoLines.push(...wrappedDescription);
	} else {
		roomInfoLines.push("You see nothing special.");
	}

	// Combine minimap and room info side by side
	// Only pad when there's a corresponding roomInfoLine
	const minLines = Math.min(minimapLines.length, roomInfoLines.length);
	for (let i = 0; i < minLines; i++) {
		const minimapLine = minimapLines[i];
		const roomInfoLine = roomInfoLines[i];

		// Pad minimap line to fixed width based on visible width (not string length)
		const minimapVisibleWidth = SIZER.size(minimapLine);
		const paddingNeeded = minimapColumnWidth - minimapVisibleWidth;
		const paddedMinimap = minimapLine + " ".repeat(Math.max(0, paddingNeeded));
		lines.push(paddedMinimap + roomInfoLine);
	}

	// Add any remaining minimap lines without padding (no room info to align with)
	for (let i = minLines; i < minimapLines.length; i++) {
		lines.push(minimapLines[i]);
	}

	// Add any remaining room info lines with padding (no minimap to align with)
	for (let i = minLines; i < roomInfoLines.length; i++) {
		const roomInfoLine = roomInfoLines[i];
		const paddedMinimap = " ".repeat(minimapColumnWidth);
		lines.push(paddedMinimap + roomInfoLine);
	}

	// Available exits - appears after minimap/room info block
	const exits: DIRECTION[] = [];
	for (const dir of DIRECTIONS) {
		if (room.canExit(mob, dir) && room.getStep(dir)) {
			exits.push(dir);
		}
	}

	if (exits.length > 0) {
		const exitList = exits.map((dir) => dir2text(dir, true)).join(", ");
		lines.push(`Exits: ${exitList}`);
	} else {
		lines.push("Exits: None.");
	}

	// Room contents (excluding the viewer) - appears after minimap/room info block
	const contents = room.contents.filter((obj) => obj !== mob);
	if (contents.length > 0) {
		const contentList = contents.map(
			(obj) => obj.roomDescription || obj.display || obj.keywords
		);
		lines.push(...contentList);
	}

	character.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
}

/**
 * Displays information about an object.
 * For mobs, shows equipped items. For other objects, shows their long description.
 *
 * @param actor The mob viewing the object
 * @param obj The object to look at
 */
export function showObject(actor: Mob, obj: DungeonObject): void {
	const character = actor.character;
	if (!character) return;

	const lines: string[] = [];

	// Display name
	if (obj.display) {
		lines.push(`${color(obj.display, COLOR.CYAN)}:`);
	}

	// For mobs, show equipment
	// For non-mobs, show long description
	if (obj.description) {
		lines.push(`> ${obj.description}`);
	} else {
		lines.push("> You see nothing special.");
	}

	if (obj instanceof Mob) {
		lines.push("");
		lines.push(`${color(`${obj.display} is wearing...`, COLOR.YELLOW)}`);
		const formatted = getEquipmentList(obj).map((line) => `> ${line}`);
		lines.push(...formatted);
	}

	character.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
}

/**
 * Groups an array of objects using a key function.
 * Returns a Map where each key is determined by the keyFn,
 * and the value contains one representative item and the count of items with that key.
 *
 * @param items Array of objects to group
 * @param keyFn Function that takes an item and returns a string key for grouping
 * @returns Map of grouped items with counts
 *
 * @example
 * ```typescript
 * const items = [item1, item2, item3];
 * // Group by display and keywords
 * const groups = groupItems(items, (item) => `${item.display}|${item.keywords}`);
 * // groups.get("sword|sword") = { item: item1, count: 2 }
 *
 * // Group by templateId
 * const groupsByTemplate = groupItems(items, (item) => item.templateId || 'no-template');
 * ```
 */
export function groupItems<T>(
	items: T[],
	keyFn: (item: T) => string
): Map<string, { item: T; count: number }> {
	const groups = new Map<string, { item: T; count: number }>();

	for (const item of items) {
		const key = keyFn(item);

		const existing = groups.get(key);
		if (existing) {
			existing.count++;
		} else {
			groups.set(key, { item, count: 1 });
		}
	}

	return groups;
}

/**
 * Displays the contents of a container.
 * Shows the container's description and lists all items inside it.
 *
 * @param actor The mob viewing the container
 * @param container The container to look inside
 */
export function showContainerContents(
	actor: Mob,
	container: DungeonObject
): void {
	const character = actor.character;
	if (!character) return;

	const lines: string[] = [];

	// Display container name
	if (container.display) {
		lines.push(
			`${color(`Looking inside ${container.display}...`, COLOR.CYAN)}`
		);
	}

	// Show container description if it has one
	if (container.description) {
		lines.push(`> ${container.description}`);
	}

	// Show contents
	const contents = container.contents;
	const items = contents.filter((obj) => obj instanceof Item) as Item[];

	if (items.length === 0) {
		lines.push("> It is empty.");
	} else {
		lines.push("");
		lines.push(`${color("Contents:", COLOR.YELLOW)}`);

		// Group items by display, keywords, and templateId (same as inventory)
		const displayAndKeywordsKeyFn = (item: Item) =>
			`${item.display}|${item.keywords}`;
		const templateIdKeyFn = (item: Item) => item.templateId || "no-template";
		const standardKeyFn = (item: Item) =>
			`${displayAndKeywordsKeyFn(item)}|${templateIdKeyFn(item)}`;

		const itemGroups = groupItems(items, standardKeyFn);

		for (const { item, count } of itemGroups.values()) {
			let line = `  ${item.display || item.keywords}`;

			// Add count if more than one
			if (count > 1) {
				line += ` ${color(`(x${count})`, COLOR.GREY)}`;
			}

			lines.push(line);
		}
	}

	character.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
}
