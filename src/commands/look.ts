/**
 * Look command for viewing the current room, adjacent rooms, or objects.
 *
 * Allows players to view their current room description, look in a specific
 * direction to see an adjacent room, or look at objects in the room or inventory.
 * When looking at a mob, shows their equipped items. When looking at other objects,
 * shows their long description.
 *
 * @example
 * ```
 * look
 * l
 * look north
 * look n
 * look sword
 * look goblin
 * ```
 *
 * **Aliases:** `l`
 * **Pattern:** `look~ [<target:object@all>] [<direction:direction>]`
 * @module commands/look
 */

import { CommandContext } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import {
	Room,
	DIRECTION,
	dir2text,
	DIRECTIONS,
	DungeonObject,
} from "../dungeon.js";
import { getEquipmentList } from "../equipment.js";
import { Mob } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import { COLOR, color, SIZER } from "../color.js";
import { LINEBREAK } from "../telnet.js";
import { string } from "mud-ext";
import { generateMinimap } from "../minimap.js";

/**
 * Displays a room description to a player.
 * Shows the room's display name, description, contents, available exits, and a minimap.
 * The minimap is displayed on the left with room information on the right.
 *
 * @param mob The mob viewing the room
 * @param room The room to display
 * @param minimapSize Optional size for the minimap (default: 1, which shows a 3x3 grid)
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
function showObject(actor: Mob, obj: DungeonObject): void {
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

export default {
	pattern: "look~",
	aliases: ["look~ <target:object@all>", "look~ <direction:direction>"],
	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor, room } = context;

		if (!room) {
			actor.sendMessage(
				"You are not in a room.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const target = args.get("target") as DungeonObject | undefined;
		const direction = args.get("direction") as DIRECTION | undefined;

		// If target object is specified, show that object
		if (target) {
			showObject(actor, target);
			return;
		}

		// If direction specified, show that room
		if (direction) {
			// Check if we can move in that direction
			if (!actor.canStep(direction)) {
				actor.sendMessage(
					`You cannot look ${dir2text(direction)}.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			// Get the adjacent room
			const targetRoom = actor.getStep(direction);
			if (!targetRoom || !(targetRoom instanceof Room)) {
				actor.sendMessage(
					`You cannot look ${dir2text(direction)}.`,
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
				return;
			}

			// Show the adjacent room
			actor.sendMessage(
				`Looking ${dir2text(direction)}...`,
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			showRoom(actor, targetRoom);
			return;
		}

		// If nothing specified, show current room
		showRoom(actor, room);
	},
} satisfies CommandObject;
