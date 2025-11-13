/**
 * Look command for viewing the current room or adjacent rooms.
 *
 * Allows players to view their current room description, or look in a specific
 * direction to see an adjacent room. Looking in a direction requires that the
 * player can move in that direction.
 *
 * @example
 * ```
 * look
 * l
 * look north
 * look n
 * ```
 *
 * **Aliases:** `l`
 * **Pattern:** `look~ [<direction:direction>]`
 * @module commands/look
 */

import { CommandContext, ParseResult } from "../command.js";
import { MESSAGE_GROUP } from "../character.js";
import { Room, DIRECTION, dir2text, DIRECTIONS } from "../dungeon.js";
import { Mob } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import { COLOR, color, SIZER } from "../color.js";
import { LINEBREAK } from "../telnet.js";
import { string } from "mud-ext";

const ALTERNATING_MINIMAP_CHARS = [",", "'"];
const ALTERNATING_MINIMAP_COLORS = [COLOR.DARK_GREEN, COLOR.TEAL];

/**
 * Generates a minimap showing rooms around the current room.
 * Displays a grid of rooms with the current room marked.
 *
 * @param room The center room for the minimap
 * @param mob The mob viewing the minimap (for checking exits)
 * @param size The number of tiles to show in each direction (size 1 = 3x3, size 2 = 5x5)
 * @returns A string representation of the minimap, or undefined if no dungeon
 */
function generateMinimap(
	room: Room,
	mob: Mob,
	size: number
): string | undefined {
	const dungeon = room.dungeon;
	if (!dungeon) return undefined;

	const coords = room.coordinates;
	const gridSize = size * 2 + 1;
	const lines: string[] = [];

	// Build the grid from top to bottom (north to south)
	for (let y = coords.y - size; y <= coords.y + size; y++) {
		const row: string[] = [];
		for (let x = coords.x - size; x <= coords.x + size; x++) {
			let mapText = " ";
			let mapColor = COLOR.DARK_GREEN;
			const targetRoom = dungeon.getRoom({ x, y, z: coords.z });
			if (targetRoom) {
				mapText =
					targetRoom.mapText ??
					ALTERNATING_MINIMAP_CHARS[
						(targetRoom.x * targetRoom.y + targetRoom.z) % 2
					];
				mapColor =
					targetRoom.mapColor ??
					ALTERNATING_MINIMAP_COLORS[
						(targetRoom.x * targetRoom.y + targetRoom.z) % 2
					];
				if (targetRoom === room) {
					mapText = "@";
					mapColor = COLOR.PINK;
				} else {
					// Check if room has a mob
					const mobInRoom = targetRoom.contents.find(
						(obj) => obj instanceof Mob
					) as Mob | undefined;
					if (mobInRoom) {
						// Room with mob - use mob's mapText/mapColor or default to !
						mapText = mobInRoom.mapText ?? "!";
						mapColor = mobInRoom.mapColor ?? COLOR.YELLOW;
					}
				}
			}
			row.push(color(mapText, mapColor));
		}
		lines.push(row.join(" "));
	}

	return lines.join("\n");
}

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
	const minimapLines = minimap ? minimap.split("\n") : [];

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
		roomInfoLines.push(color(titleWithCoords, COLOR.CYAN));
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

export default {
	pattern: "look~ <direction:direction?>",
	execute(context: CommandContext, args: Map<string, any>): void {
		const { actor, room } = context;

		if (!room) {
			actor.sendMessage(
				"You are not in a room.",
				MESSAGE_GROUP.COMMAND_RESPONSE
			);
			return;
		}

		const direction = args.get("direction") as DIRECTION | undefined;

		// If no direction specified, show current room
		if (!direction) {
			showRoom(actor, room);
			return;
		}

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
	},
} satisfies CommandObject;
