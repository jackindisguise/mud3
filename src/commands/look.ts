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
import { Mob, Room, DIRECTION, dir2text, DIRECTIONS } from "../dungeon.js";
import { CommandObject } from "../package/commands.js";
import { COLOR, color, SIZER } from "../color.js";
import { LINEBREAK } from "../telnet.js";

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
			const targetRoom = dungeon.getRoom({ x, y, z: coords.z });
			if (!targetRoom) {
				// No room at this location
				row.push("#");
			} else if (targetRoom === room) {
				// Current room - mark with @
				row.push(color("@", COLOR.YELLOW));
			} else {
				// Other room - show as .
				row.push(".");
			}
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
export function showRoom(mob: Mob, room: Room, minimapSize: number = 1): void {
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

	// Build room info lines (title and description only - for side-by-side display)
	const roomInfoLines: string[] = [];

	// Room title
	if (room.display) {
		roomInfoLines.push(color(room.display, COLOR.CYAN));
	}

	// Room description
	if (room.description) {
		roomInfoLines.push(room.description);
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
		const contentList = contents
			.map((obj) => obj.roomDescription || obj.display || obj.keywords)
			.join(", ");
		lines.push(`- ${contentList}`);
	}

	character.sendMessage(lines.join(LINEBREAK), MESSAGE_GROUP.COMMAND_RESPONSE);
}

export default {
	pattern: "look~ <direction:direction?>",
	aliases: ["l <direction:direction?>"],
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
